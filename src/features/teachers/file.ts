import "server-only";

import { getActiveYear } from "@/features/classes/academic";
import { can } from "@/lib/auth/authorize";
import { schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { historyByYear, sheetProgress, teacherFileAccess, type CourseLine } from "./file-rules";

type User = NonNullable<CurrentUser>;

// What the viewer may read on the file, beyond the file itself.
export function fileRights(user: User) {
  return {
    // Phone, e-mail, account and last sign in: the accounts that manage
    // accounts (ministry, departments, circonscriptions, by default).
    contacts: can(user, "user:view"),
    // Who recorded the person in the registry, from the activity log.
    journal: can(user, "audit:view"),
    grades: can(user, "grade:view"),
    attendance: can(user, "attendance:view"),
    mockExams: can(user, "mock_exam:view"),
    timetable: can(user, "timetable:view"),
    // The ministry keeps the registry of the agents of the State.
    registry: user.scope.level === "NATIONAL" && can(user, "teacher:update"),
  };
}

const yearSelect = { id: true, label: true, startDate: true, isActive: true } as const;

// The file of a person of the registry, or null when the viewer may not open
// it (see teacherFileAccess): the page answers 404 either way, so a guessed
// identifier tells nothing.
export async function getTeacherFile(user: User, profileId: string) {
  const [profile, inScope] = await Promise.all([
    db.teacherProfile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        npi: true,
        firstName: true,
        lastName: true,
        gender: true,
        phone: true,
        email: true,
        stateStatus: true,
        stateMatricule: true,
        createdAt: true,
        userId: true,
        user: { select: { username: true, lastLoginAt: true, isActive: true } },
        teachers: { select: { id: true, isActive: true } },
      },
    }),
    db.teacher.findMany({ where: { profileId, school: schoolWhere(user) }, select: { id: true } }),
  ]);
  if (!profile) return null;
  const scoped = new Set(inScope.map((t) => t.id));
  const access = teacherFileAccess({
    level: user.scope.level,
    canView: can(user, "teacher:view"),
    stateAgent: !!profile.stateStatus,
    appointments: profile.teachers.map((t) => ({ id: t.id, isActive: t.isActive, inScope: scoped.has(t.id) })),
  });
  if (!access.allowed) return null;

  const year = await getActiveYear();
  const yearId = year?.id ?? "__none__";
  const appointments = await db.teacher.findMany({
    // Filtered by the scope again: the ids come from it, the filter keeps
    // this query safe on its own.
    where: { AND: [{ id: { in: access.visibleIds } }, { school: schoolWhere(user) }] },
    select: {
      id: true,
      matricule: true,
      status: true,
      specialty: true,
      hiredAt: true,
      isActive: true,
      school: { select: { id: true, name: true, code: true, sector: true, cycle: true, commune: { select: { name: true, department: { select: { name: true } } } } } },
      assignments: {
        select: {
          id: true,
          weeklyHours: true,
          subject: { select: { name: true } },
          classroom: { select: { id: true, name: true, level: { select: { order: true } }, academicYear: { select: yearSelect }, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } } },
          gradeSheets: { select: { isLocked: true, _count: { select: { grades: true } } } },
          timetable: { select: { dayOfWeek: true } },
        },
        orderBy: [{ classroom: { level: { order: "asc" } } }, { classroom: { name: "asc" } }],
      },
      mainClasses: { select: { name: true, academicYear: { select: yearSelect } }, orderBy: { name: "asc" } },
    },
    orderBy: [{ isActive: "desc" }, { school: { name: "asc" } }],
  });
  const schoolIds = appointments.map((a) => a.school.id);
  const teacherIds = appointments.map((a) => a.id);

  // Current year, per school.
  const current = appointments
    .map((a) => {
      const courses = a.assignments.filter((c) => c.classroom.academicYear.id === yearId);
      const classes = new Map(courses.map((c) => [c.classroom.id, c.classroom._count.enrollments]));
      const days = courses.flatMap((c) => c.timetable.map((s) => s.dayOfWeek));
      return {
        teacherId: a.id,
        school: a.school,
        courses: courses.map((c) => ({ id: c.id, classroom: c.classroom.name, subject: c.subject.name, weeklyHours: c.weeklyHours, students: c.classroom._count.enrollments })),
        mainClasses: a.mainClasses.filter((m) => m.academicYear.id === yearId).map((m) => m.name),
        hours: courses.reduce((n, c) => n + c.weeklyHours, 0),
        classes: classes.size,
        students: [...classes.values()].reduce((n, v) => n + v, 0),
        slots: days.length,
        days,
      };
    })
    .filter((c) => c.courses.length || c.mainClasses.length);

  // Every year of the data, grouped.
  const lines: CourseLine[] = appointments.flatMap((a) => [
    ...a.assignments.map((c) => ({ year: c.classroom.academicYear, schoolId: a.school.id, schoolName: a.school.name, classroom: c.classroom.name, subject: c.subject.name, weeklyHours: c.weeklyHours })),
    ...a.mainClasses.map((m) => ({ year: m.academicYear, schoolId: a.school.id, schoolName: a.school.name, classroom: m.name, subject: null, weeklyHours: 0, main: true })),
  ]);

  const rights = fileRights(user);
  const userId = profile.userId;
  const [registers, mockResults, absences, journal] = await Promise.all([
    // Registers taken by the person's account this year in these schools:
    // one per class, day and half day.
    rights.attendance && userId && year
      ? db.$queryRaw<{ n: bigint }[]>`
          SELECT count(*) AS n FROM (
            SELECT DISTINCT e."classroomId", a."date", a."half"
            FROM "StudentAttendance" a JOIN "Enrollment" e ON e.id = a."enrollmentId"
            WHERE a."recordedById" = ${userId} AND e."academicYearId" = ${year.id} AND e."schoolId" = ANY(${schoolIds}::text[])
          ) x`.then((r) => Number(r[0]?.n ?? 0))
      : Promise.resolve(null),
    rights.mockExams && userId && year
      ? db.$queryRaw<{ n: bigint }[]>`
          SELECT count(*) AS n
          FROM "MockExamResult" r JOIN "MockExam" m ON m.id = r."examId" JOIN "Enrollment" e ON e.id = r."enrollmentId"
          WHERE r."enteredById" = ${userId} AND m."academicYearId" = ${year.id} AND e."schoolId" = ANY(${schoolIds}::text[])`.then((r) => Number(r[0]?.n ?? 0))
      : Promise.resolve(null),
    // Days the schools recorded the person absent this year.
    rights.attendance && year
      ? db.teacherAttendance.count({ where: { teacherId: { in: teacherIds }, status: "ABSENT", date: { gte: year.startDate, lte: year.endDate } } })
      : Promise.resolve(null),
    // The registry entries: the ministry's (on the profile) and the
    // creation by a school of the scope (on its appointment).
    db.auditLog.findMany({
      where: { resource: "teacher", OR: [{ resourceId: profile.id, action: { in: ["create", "update"] } }, { resourceId: { in: teacherIds }, action: "create" }] },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, action: true, resourceId: true, createdAt: true, user: { select: { firstName: true, lastName: true, role: { select: { name: true } } } } },
    }),
  ]);

  const sheets = rights.grades ? sheetProgress(appointments.flatMap((a) => a.assignments.filter((c) => c.classroom.academicYear.id === yearId).flatMap((c) => c.gradeSheets.map((s) => ({ isLocked: s.isLocked, grades: s._count.grades }))))) : null;

  return {
    rights,
    profile,
    year: year ? { id: year.id, label: year.label } : null,
    appointments: appointments.map((a) => ({ id: a.id, matricule: a.matricule, status: a.status, specialty: a.specialty, hiredAt: a.hiredAt, isActive: a.isActive, school: a.school })),
    hiddenActive: access.hiddenActive,
    specialty: appointments.find((a) => a.specialty)?.specialty ?? null,
    current,
    history: historyByYear(lines),
    activity: { sheets, registers, mockResults, absences, hasAccount: !!profile.user },
    journal: journal.map((j) => ({
      id: j.id,
      at: j.createdAt,
      what:
        j.resourceId === profile.id
          ? j.action === "create"
            ? "Inscription au registre de l'État"
            : "Mise à jour du registre de l'État"
          : `Nomination à ${appointments.find((a) => a.id === j.resourceId)?.school.name ?? "un établissement"}`,
      // The author's name stays with the accounts that read the activity log.
      by: rights.journal && j.user ? `${j.user.firstName} ${j.user.lastName}, ${j.user.role.name}` : null,
    })),
  };
}

export type TeacherFile = NonNullable<Awaited<ReturnType<typeof getTeacherFile>>>;
