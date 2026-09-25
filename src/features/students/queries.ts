import "server-only";

import type { EnrollmentStatus, Prisma } from "@/generated/prisma/client";
import { getActiveYear, getCurrentPeriod } from "@/features/classes/academic";
import { computeClassCards } from "@/features/report-cards/compute";
import { can } from "@/lib/auth/authorize";
import { enrollmentWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { attendanceRate } from "@/lib/domain/attendance";
import { subjectAverage, type GradeInput } from "@/lib/domain/grades";
import { db } from "@/lib/db";
import { sortByName } from "@/lib/utils";

type User = NonNullable<CurrentUser>;

export async function listStudents(
  user: User,
  opts: { q: string; classroomId?: string; status: EnrollmentStatus | "ALL"; skip: number; take: number },
) {
  const year = await getActiveYear();
  const where: Prisma.EnrollmentWhereInput = {
    AND: [
      enrollmentWhere(user),
      { academicYearId: year?.id ?? "__none__" },
      opts.status === "ALL" ? {} : { status: opts.status },
      opts.classroomId ? { classroomId: opts.classroomId } : {},
      opts.q
        ? {
            student: {
              OR: [
                { lastName: { contains: opts.q, mode: "insensitive" } },
                { firstName: { contains: opts.q, mode: "insensitive" } },
                { matricule: { contains: opts.q, mode: "insensitive" } },
              ],
            },
          }
        : {},
    ],
  };
  // French alphabetical order whatever the database collation: a C collation
  // puts "Adéoti" after "Adjovi". Prisma cannot order by a collation, so the
  // names of every matching enrollment (a few short columns) are sorted here,
  // the requested page is cut from that order, and only that page is loaded
  // in full. Pagination stays exact: skip and take apply to the sorted list,
  // and the total is its length.
  const keys = sortByName(
    await db.enrollment.findMany({ where, orderBy: { id: "asc" }, select: { id: true, student: { select: { lastName: true, firstName: true } } } }),
    (e) => e.student,
  );
  const pageIds = keys.slice(opts.skip, opts.skip + opts.take).map((k) => k.id);
  const position = new Map(pageIds.map((id, i) => [id, i]));
  const page = await db.enrollment.findMany({
    where: { id: { in: pageIds } },
    select: {
      id: true,
      status: true,
      isRepeating: true,
      classroom: { select: { id: true, name: true } },
      school: { select: { name: true } },
      student: {
        select: {
          id: true,
          matricule: true,
          firstName: true,
          lastName: true,
          gender: true,
          birthDate: true,
          disabilities: true,
          guardians: { where: { isPrimary: true }, take: 1, select: { guardian: { select: { firstName: true, lastName: true, phone: true } } } },
        },
      },
    },
  });
  const rows = page.sort((a, b) => position.get(a.id)! - position.get(b.id)!);
  return { rows, total: keys.length };
}

// A student is visible when at least one of their enrollments is in scope.
export function studentWhere(user: User): Prisma.StudentWhereInput {
  return { enrollments: { some: enrollmentWhere(user) } };
}

export async function getStudentProfile(user: User, studentId: string) {
  const student = await db.student.findFirst({
    where: { AND: [{ id: studentId }, studentWhere(user)] },
    include: {
      user: { select: { email: true } },
      guardians: {
        orderBy: { isPrimary: "desc" },
        include: { guardian: { select: { id: true, firstName: true, lastName: true, phone: true, profession: true, preferredChannel: true, prefersAudio: true, userId: true } } },
      },
      enrollments: {
        where: enrollmentWhere(user),
        orderBy: { academicYear: { startDate: "desc" } },
        include: {
          classroom: { select: { id: true, name: true, mainTeacher: { select: { firstName: true, lastName: true } } } },
          school: { select: { name: true } },
          academicYear: { select: { id: true, label: true, isActive: true } },
        },
      },
    },
  });
  if (!student) return null;

  const year = await getActiveYear();
  const current = student.enrollments.find((e) => e.academicYearId === year?.id) ?? null;
  const period = await getCurrentPeriod();
  // Seeing a student is not reading their results: each block is loaded only
  // with the right of what it shows (an accountant sees the identity only).
  const rights = { grades: can(user, "grade:view"), attendance: can(user, "attendance:view"), reportCards: can(user, "report_card:view") };

  const [grades, classCards, attendance, statusCounts, reportCards] = await Promise.all([
    rights.grades && current && period ? subjectGrades(current.id, current.classroomId, period.id) : [],
    rights.grades && current && period && current.status === "ACTIVE" ? computeClassCards(current.classroomId, period.id) : null,
    rights.attendance && current
      ? db.studentAttendance.findMany({
          where: { enrollmentId: current.id, status: { not: "PRESENT" } },
          orderBy: [{ date: "desc" }, { half: "asc" }],
          take: 30,
          select: { id: true, date: true, half: true, status: true, reason: true },
        })
      : [],
    rights.attendance && current ? db.studentAttendance.groupBy({ by: ["status"], where: { enrollmentId: current.id }, _count: { _all: true } }) : [],
    !rights.reportCards
      ? []
      : db.reportCard.findMany({
          where: { enrollment: { AND: [{ studentId: student.id }, enrollmentWhere(user)] } },
          orderBy: [{ period: { academicYear: { startDate: "desc" } } }, { period: { order: "desc" } }],
          select: { id: true, enrollmentId: true, periodId: true, generalAverage: true, rank: true, classSize: true, publishedAt: true, period: { select: { name: true, academicYear: { select: { label: true } } } } },
        }),
  ]);
  const counts = Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all]));
  const myCard = classCards?.cards.find((c) => c.enrollmentId === current?.id) ?? null;
  return {
    rights,
    student,
    current,
    period,
    grades,
    general: myCard ? { average: myCard.generalAverage, rank: myCard.rank, classSize: classCards!.cards.length } : null,
    attendance,
    attendanceCounts: counts,
    attendanceRate: attendanceRate(counts),
    reportCards,
  };
}

// Current period breakdown per subject for one enrollment.
async function subjectGrades(enrollmentId: string, classroomId: string, periodId: string) {
  const assignments = await db.courseAssignment.findMany({
    where: { classroomId },
    orderBy: [{ coefficient: "desc" }, { subject: { name: "asc" } }],
    select: {
      id: true,
      coefficient: true,
      subject: { select: { name: true } },
      teacher: { select: { firstName: true, lastName: true } },
      gradeSheets: {
        where: { periodId },
        select: { formula: true, isLocked: true, grades: { where: { enrollmentId }, select: { type: true, sequence: true, value: true, maxValue: true } } },
      },
    },
  });
  return assignments.map((a) => {
    const sheet = a.gradeSheets[0];
    const list: GradeInput[] = (sheet?.grades ?? []).map((g) => ({ type: g.type, value: Number(g.value), maxValue: Number(g.maxValue) }));
    const breakdown = subjectAverage(sheet?.formula ?? "WEIGHTED_STANDARD", list);
    return {
      id: a.id,
      subject: a.subject.name,
      coefficient: a.coefficient,
      teacher: a.teacher ? `${a.teacher.firstName} ${a.teacher.lastName}` : null,
      hasSheet: !!sheet,
      locked: sheet?.isLocked ?? false,
      count: list.length,
      ...breakdown,
    };
  });
}

// Guardians already known in the user's scope, for the "existing guardian"
// choice of the enrollment form.
export async function guardianOptions(user: User) {
  const guardians = await db.guardian.findMany({
    where: { students: { some: { student: studentWhere(user) } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true, phone: true },
    take: 1000,
  });
  return sortByName(guardians, (g) => g);
}

export async function getStudentForEdit(user: User, studentId: string) {
  const year = await getActiveYear();
  return db.student.findFirst({
    where: { AND: [{ id: studentId }, studentWhere(user)] },
    include: {
      enrollments: { where: { AND: [enrollmentWhere(user), { academicYearId: year?.id ?? "__none__" }] }, select: { id: true, classroomId: true, isRepeating: true, status: true } },
    },
  });
}
