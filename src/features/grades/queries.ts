import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { assignmentWriteWhere, classroomWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { evaluationColumns, sheetProgress } from "@/lib/domain/grade-entry";
import { db } from "@/lib/db";

type User = NonNullable<CurrentUser>;

// Sheets a user may read: those of the classes in their scope. A teacher's
// list shows their own sheets; they can still open, read only, the sheets of
// a class they lead as main teacher.
export function sheetReadWhere(user: User): Prisma.GradeSheetWhereInput {
  return { assignment: { classroom: classroomWhere(user) } };
}

// Sheets a user may write on: their own assignments for a teacher, the
// school's for staff.
export function sheetWriteWhere(user: User): Prisma.GradeSheetWhereInput {
  return { assignment: assignmentWriteWhere(user) };
}

export async function listSheets(user: User, opts: { periodId: string; classroomId?: string; q: string; skip: number; take: number }) {
  const where: Prisma.GradeSheetWhereInput = {
    AND: [
      sheetReadWhere(user),
      user.teacherId && user.scope.level === "SCHOOL" && !opts.classroomId ? { assignment: { teacherId: user.teacherId } } : {},
      { periodId: opts.periodId },
      opts.classroomId ? { assignment: { classroomId: opts.classroomId } } : {},
      opts.q
        ? {
            OR: [
              { assignment: { subject: { name: { contains: opts.q, mode: "insensitive" } } } },
              { assignment: { classroom: { name: { contains: opts.q, mode: "insensitive" } } } },
              { assignment: { teacher: { lastName: { contains: opts.q, mode: "insensitive" } } } },
            ],
          }
        : {},
    ],
  };
  const [sheets, total] = await Promise.all([
    db.gradeSheet.findMany({
      where,
      orderBy: [{ assignment: { classroom: { level: { order: "asc" } } } }, { assignment: { classroom: { name: "asc" } } }, { assignment: { coefficient: "desc" } }, { assignment: { subject: { name: "asc" } } }],
      skip: opts.skip,
      take: opts.take,
      select: {
        id: true,
        formula: true,
        interrogationCount: true,
        devoirCount: true,
        compositionCount: true,
        isLocked: true,
        lockedAt: true,
        assignment: {
          select: {
            teacherId: true,
            coefficient: true,
            subject: { select: { name: true } },
            teacher: { select: { firstName: true, lastName: true } },
            classroom: { select: { id: true, name: true, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } } },
          },
        },
        _count: { select: { grades: { where: { enrollment: { status: "ACTIVE" } } } } },
      },
    }),
    db.gradeSheet.count({ where }),
  ]);
  const rows = sheets.map((s) => {
    const evaluations = s.interrogationCount + s.devoirCount + s.compositionCount;
    const students = s.assignment.classroom._count.enrollments;
    return { ...s, students, progress: sheetProgress(s._count.grades, students, evaluations) };
  });
  return { rows, total };
}

// Assignments on which the user can open a sheet for this period.
export async function assignmentsWithoutSheet(user: User, periodId: string, yearId: string) {
  return db.courseAssignment.findMany({
    where: {
      AND: [assignmentWriteWhere(user), { classroom: classroomWhere(user) }, { classroom: { academicYearId: yearId } }, { gradeSheets: { none: { periodId } } }],
    },
    orderBy: [{ classroom: { level: { order: "asc" } } }, { classroom: { name: "asc" } }, { subject: { name: "asc" } }],
    select: { id: true, subject: { select: { name: true } }, classroom: { select: { name: true } } },
    take: 500,
  });
}

export async function getSheetForEntry(user: User, id: string) {
  const sheet = await db.gradeSheet.findFirst({
    where: { AND: [{ id }, sheetReadWhere(user)] },
    include: {
      period: { select: { id: true, name: true, isClosed: true, academicYear: { select: { label: true } } } },
      lockedBy: { select: { firstName: true, lastName: true } },
      assignment: {
        include: {
          subject: true,
          teacher: { select: { firstName: true, lastName: true } },
          classroom: { select: { id: true, name: true, schoolId: true, school: { select: { name: true } } } },
        },
      },
    },
  });
  if (!sheet) return null;
  const [enrollments, grades, writable] = await Promise.all([
    db.enrollment.findMany({
      where: { classroomId: sheet.assignment.classroomId, status: "ACTIVE" },
      orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
      select: { id: true, student: { select: { id: true, matricule: true, firstName: true, lastName: true, disabilities: true } } },
    }),
    db.grade.findMany({ where: { gradeSheetId: sheet.id }, select: { enrollmentId: true, type: true, sequence: true, value: true } }),
    db.gradeSheet.count({ where: { AND: [{ id: sheet.id }, sheetWriteWhere(user)] } }),
  ]);
  const columns = evaluationColumns(sheet);
  const byEnrollment = new Map<string, Record<string, string>>();
  for (const g of grades) {
    const row = byEnrollment.get(g.enrollmentId) ?? {};
    row[`${g.type}:${g.sequence}`] = Number(g.value).toString().replace(".", ",");
    byEnrollment.set(g.enrollmentId, row);
  }
  const rows = enrollments.map((e) => ({
    enrollmentId: e.id,
    studentId: e.student.id,
    name: `${e.student.lastName} ${e.student.firstName}`,
    matricule: e.student.matricule,
    values: byEnrollment.get(e.id) ?? {},
  }));
  return { sheet, columns, rows, inWriteScope: writable > 0 };
}

export async function sheetFilterOptions(user: User, yearId: string) {
  return db.classroom.findMany({
    where: { AND: [classroomWhere(user), { academicYearId: yearId }] },
    orderBy: [{ level: { order: "asc" } }, { name: "asc" }],
    select: { id: true, name: true },
    take: 500,
  });
}
