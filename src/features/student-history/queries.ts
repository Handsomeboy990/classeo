import "server-only";

import { enrollmentWhere, isTeacherRole, schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { attendanceRate, countStatuses, type AttendanceStatusCode } from "@/lib/domain/attendance";
import { db } from "@/lib/db";

import { historyReach, reaches, recordAccessValid, type HistoryReach, type HistoryViewer } from "./logic";

type User = NonNullable<CurrentUser>;

// Who the viewer is for this pupil. null: no relation at all.
async function viewerFor(user: User, studentId: string, pupilSchools: string[]): Promise<HistoryViewer | null> {
  const s = user.scope;
  if (s.level === "SELF") {
    const own = await db.enrollment.count({ where: { AND: [{ studentId }, enrollmentWhere(user)] } });
    return own ? { kind: "family" } : null;
  }
  if (s.level === "NATIONAL") return { kind: "national" };
  if (s.level === "DEPARTMENT" || s.level === "COMMUNE") {
    const inScope = await db.school.findMany({ where: { AND: [{ id: { in: pupilSchools } }, schoolWhere(user)] }, select: { id: true } });
    return { kind: "territory", schoolIds: new Set(inScope.map((r) => r.id)) };
  }
  if (!s.schoolId) return null;
  // A teacher reads the history of the pupils of their own classes only.
  if (isTeacherRole(user)) {
    const mine = await db.enrollment.count({ where: { AND: [{ studentId }, enrollmentWhere(user)] } });
    if (!mine) return null;
  }
  const access = await db.studentRecordAccess.findUnique({ where: { studentId_schoolId: { studentId, schoolId: s.schoolId } }, select: { expiresAt: true } });
  return { kind: "school", schoolId: s.schoolId, access: recordAccessValid(access) ? access : null };
}

type Segment = {
  key: string;
  schoolId: string;
  school: string;
  place: string;
  classroom: string;
  level: string;
  from: Date;
  to: Date | null;
  status: "ACTIVE" | "TRANSFERRED" | "WITHDRAWN";
  isRepeating: boolean;
  reportCards: { id: string; enrollmentId: string; periodId: string; period: string; average: number | null; rank: number | null; classSize: number; publishedAt: Date }[];
  attendance: { rate: number | null; absences: number; lates: number; recorded: number };
};

export type HistoryYear = { yearId: string; label: string; isActive: boolean; segments: Segment[]; hidden: number };

// The whole school path of a pupil, cut to what the viewer may read, or
// null when the viewer may not open it (same answer as an unknown id).
export async function studentHistory(user: User, studentId: string) {
  if (typeof studentId !== "string" || studentId.length > 64) return null;
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      matricule: true,
      gender: true,
      birthDate: true,
      photoFileId: true,
      enrollments: {
        orderBy: { academicYear: { startDate: "asc" } },
        select: {
          id: true,
          schoolId: true,
          classroomId: true,
          status: true,
          isRepeating: true,
          enrolledAt: true,
          academicYear: { select: { id: true, label: true, startDate: true, endDate: true, isActive: true } },
        },
      },
      transfers: {
        orderBy: { createdAt: "asc" },
        select: { id: true, kind: true, status: true, createdAt: true, decidedAt: true, fromSchoolId: true, toSchoolId: true, fromClassroomId: true, toClassroomId: true, shareHistory: true },
      },
    },
  });
  if (!student) return null;

  const accepted = student.transfers.filter((t) => t.status === "ACCEPTED" && t.decidedAt);
  const pupilSchools = [...new Set([...student.enrollments.map((e) => e.schoolId), ...accepted.map((t) => t.fromSchoolId)])];
  const viewer = await viewerFor(user, studentId, pupilSchools);
  if (!viewer) return null;
  const reach = historyReach(viewer, pupilSchools);
  if (!reach) return null;

  const enrollmentIds = student.enrollments.map((e) => e.id);
  const classroomIds = [...new Set([...student.enrollments.map((e) => e.classroomId), ...accepted.flatMap((t) => [t.fromClassroomId, t.toClassroomId ?? ""])])].filter(Boolean);
  const [classrooms, schools, cards, attendance, accesses] = await Promise.all([
    db.classroom.findMany({ where: { id: { in: classroomIds } }, select: { id: true, name: true, level: { select: { name: true } } } }),
    db.school.findMany({ where: { id: { in: [...new Set([...pupilSchools, ...student.transfers.map((t) => t.toSchoolId)])] } }, select: { id: true, name: true, commune: { select: { name: true } } } }),
    db.reportCard.findMany({
      where: { enrollmentId: { in: enrollmentIds } },
      orderBy: { period: { order: "asc" } },
      select: { id: true, enrollmentId: true, periodId: true, generalAverage: true, rank: true, classSize: true, publishedAt: true, period: { select: { name: true, startDate: true, endDate: true } } },
    }),
    db.studentAttendance.findMany({ where: { enrollmentId: { in: enrollmentIds } }, select: { enrollmentId: true, date: true, status: true } }),
    db.studentRecordAccess.findMany({ where: { studentId }, select: { id: true, expiresAt: true, createdAt: true, school: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } }),
  ]);
  const classOf = new Map(classrooms.map((c) => [c.id, c]));
  const schoolOf = new Map(schools.map((s) => [s.id, s]));

  const years: HistoryYear[] = student.enrollments.map((e) => {
    const y = e.academicYear;
    const inYear = accepted.filter((t) => t.decidedAt! >= y.startDate && t.decidedAt! <= new Date(y.endDate.getTime() + 86_400_000));
    // Cut points of the year: each accepted move (class or school).
    const moves = inYear.map((t) => ({
      at: t.decidedAt!,
      fromSchoolId: t.fromSchoolId,
      toSchoolId: t.toSchoolId,
      fromClassroomId: t.fromClassroomId,
      toClassroomId: t.toClassroomId ?? e.classroomId,
    }));
    const bounds = [y.startDate, ...moves.map((m) => m.at)];
    const segments: Segment[] = bounds.map((from, i) => {
      const to = moves[i]?.at ?? null;
      const schoolId = moves[i]?.fromSchoolId ?? e.schoolId;
      const classroomId = moves[i]?.fromClassroomId ?? e.classroomId;
      const c = classOf.get(classroomId);
      const sc = schoolOf.get(schoolId);
      const inside = (d: Date) => d >= from && (!to || d < to);
      const segCards = cards.filter((r) => r.enrollmentId === e.id && inside(r.publishedAt));
      const days = attendance.filter((a) => a.enrollmentId === e.id && inside(a.date));
      const counts = countStatuses(days.map((d) => d.status as AttendanceStatusCode));
      return {
        key: `${e.id}:${i}`,
        schoolId,
        school: sc?.name ?? "Établissement",
        place: sc?.commune.name ?? "",
        classroom: c?.name ?? "Classe",
        level: c?.level.name ?? "",
        from,
        to,
        status: to ? "TRANSFERRED" : e.status,
        isRepeating: e.isRepeating,
        reportCards: segCards.map((r) => ({
          id: r.id,
          enrollmentId: r.enrollmentId,
          periodId: r.periodId,
          period: r.period.name,
          average: r.generalAverage === null ? null : Number(r.generalAverage),
          rank: r.rank,
          classSize: r.classSize,
          publishedAt: r.publishedAt,
        })),
        attendance: { rate: attendanceRate(counts), absences: counts.ABSENT ?? 0, lates: counts.LATE ?? 0, recorded: days.length },
      };
    });
    const visible = segments.filter((s) => reaches(reach, s.schoolId));
    return { yearId: y.id, label: y.label, isActive: y.isActive, segments: visible, hidden: segments.length - visible.length };
  });

  const transfers = student.transfers
    .filter((t) => reaches(reach, t.fromSchoolId) || reaches(reach, t.toSchoolId))
    .map((t) => ({
      ...t,
      fromSchool: schoolOf.get(t.fromSchoolId)?.name ?? "",
      toSchool: schoolOf.get(t.toSchoolId)?.name ?? "",
      fromClassroom: classOf.get(t.fromClassroomId)?.name ?? null,
      toClassroom: t.toClassroomId ? (classOf.get(t.toClassroomId)?.name ?? null) : null,
    }))
    .reverse();

  return {
    student,
    reach: reach as HistoryReach,
    full: reach.all,
    years: years.reverse(),
    transfers,
    accesses: accesses.map((a) => ({ ...a, valid: recordAccessValid(a) })),
  };
}

export type StudentHistory = NonNullable<Awaited<ReturnType<typeof studentHistory>>>;

// The school holding the pupil this year, when it is the user's: only it may
// share the record with another school.
export async function currentHolder(user: User, studentId: string) {
  if (user.scope.level !== "SCHOOL" || !user.scope.schoolId) return null;
  const e = await db.enrollment.findFirst({
    where: { studentId, schoolId: user.scope.schoolId, status: "ACTIVE", academicYear: { isActive: true } },
    select: { id: true },
  });
  return e ? user.scope.schoolId : null;
}
