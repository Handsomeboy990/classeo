import "server-only";

import type { AttendanceStatus, DayHalf, Prisma } from "@/generated/prisma/client";
import { classroomWhere, enrollmentWhere, schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { attendanceRate, isoToDate, schoolWeek } from "@/lib/domain/attendance";
import { db } from "@/lib/db";

type User = NonNullable<CurrentUser>;

function toCounts(rows: { status: AttendanceStatus; _count: { _all: number } }[]) {
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
}

// The register of a class for a date and half day: active students with the
// status already recorded, if any.
export async function register(user: User, classroomId: string, date: string, half: DayHalf) {
  const classroom = await db.classroom.findFirst({
    where: { AND: [{ id: classroomId }, classroomWhere(user)] },
    select: { id: true, name: true, academicYear: { select: { isActive: true } } },
  });
  if (!classroom) return null;
  const enrollments = await db.enrollment.findMany({
    where: { classroomId: classroom.id, status: "ACTIVE" },
    orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
    select: {
      id: true,
      student: { select: { id: true, matricule: true, firstName: true, lastName: true, disabilities: true } },
      attendances: { where: { date: isoToDate(date), half }, select: { status: true, reason: true, recordedBy: { select: { firstName: true, lastName: true } }, createdAt: true } },
    },
  });
  const rows = enrollments.map((e) => ({
    enrollmentId: e.id,
    studentId: e.student.id,
    name: `${e.student.lastName} ${e.student.firstName}`,
    matricule: e.student.matricule,
    status: e.attendances[0]?.status ?? null,
    reason: e.attendances[0]?.reason ?? "",
  }));
  const recorder = enrollments.find((e) => e.attendances[0])?.attendances[0]?.recordedBy ?? null;
  return { classroom, rows, recorded: rows.some((r) => r.status !== null), recorder };
}

// Rates for the attendance dashboard. `classroomId` narrows to a class; the
// school figures always use the user's scope.
export async function attendanceStats(user: User, date: string, classroomId?: string) {
  const week = schoolWeek(date);
  const inScope: Prisma.StudentAttendanceWhereInput = { enrollment: { AND: [enrollmentWhere(user), { status: "ACTIVE" }] } };
  const inClass: Prisma.StudentAttendanceWhereInput = classroomId ? { enrollment: { classroomId } } : {};
  const day = { date: isoToDate(date) };
  const weekRange = { date: { gte: isoToDate(week.from), lte: isoToDate(week.to) } };

  const [classDay, classWeek, scopeDay, absentToday] = await Promise.all([
    db.studentAttendance.groupBy({ by: ["status"], where: { AND: [inScope, inClass, day] }, _count: { _all: true } }),
    db.studentAttendance.groupBy({ by: ["status"], where: { AND: [inScope, inClass, weekRange] }, _count: { _all: true } }),
    db.studentAttendance.groupBy({ by: ["status"], where: { AND: [inScope, day] }, _count: { _all: true } }),
    db.studentAttendance.count({ where: { AND: [inScope, day, { status: "ABSENT" }] } }),
  ]);
  return {
    week,
    classDayRate: attendanceRate(toCounts(classDay)),
    classWeekRate: attendanceRate(toCounts(classWeek)),
    scopeDayRate: attendanceRate(toCounts(scopeDay)),
    absentToday,
  };
}

// Top absentees over the active year (AttendanceService::getStats).
export async function mostAbsent(user: User, yearId: string, classroomId?: string, take = 5) {
  const grouped = await db.studentAttendance.groupBy({
    by: ["enrollmentId"],
    where: { status: "ABSENT", enrollment: { AND: [enrollmentWhere(user), { academicYearId: yearId, status: "ACTIVE" }, classroomId ? { classroomId } : {}] } },
    _count: { _all: true },
    orderBy: { _count: { enrollmentId: "desc" } },
    take,
  });
  const enrollments = await db.enrollment.findMany({
    where: { id: { in: grouped.map((g) => g.enrollmentId) } },
    select: { id: true, student: { select: { id: true, firstName: true, lastName: true } }, classroom: { select: { name: true } } },
  });
  const byId = new Map(enrollments.map((e) => [e.id, e]));
  return grouped
    .map((g) => ({ enrollment: byId.get(g.enrollmentId), absences: g._count._all }))
    .filter((r): r is { enrollment: NonNullable<typeof r.enrollment>; absences: number } => !!r.enrollment);
}

export async function teacherRegister(user: User, date: string) {
  const teachers = await db.teacher.findMany({
    where: { isActive: true, school: schoolWhere(user) },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      specialty: true,
      matricule: true,
      attendances: { where: { date: isoToDate(date) }, select: { status: true, reason: true } },
    },
    take: 300,
  });
  return teachers.map((t) => ({
    id: t.id,
    name: `${t.lastName} ${t.firstName}`,
    detail: t.specialty ?? t.matricule,
    status: t.attendances[0]?.status ?? null,
    reason: t.attendances[0]?.reason ?? "",
  }));
}

export async function teacherStats(user: User, date: string) {
  const week = schoolWeek(date);
  const where = { teacher: { isActive: true, school: schoolWhere(user) } };
  const [day, weekRows] = await Promise.all([
    db.teacherAttendance.groupBy({ by: ["status"], where: { ...where, date: isoToDate(date) }, _count: { _all: true } }),
    db.teacherAttendance.groupBy({ by: ["status"], where: { ...where, date: { gte: isoToDate(week.from), lte: isoToDate(week.to) } }, _count: { _all: true } }),
  ]);
  return { week, dayRate: attendanceRate(toCounts(day)), weekRate: attendanceRate(toCounts(weekRows)), absentToday: toCounts(day).ABSENT ?? 0 };
}
