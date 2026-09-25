import "server-only";

import type { Prisma, TransferKind, TransferStatus } from "@/generated/prisma/client";
import { getActiveYear } from "@/features/classes/academic";
import { enrollmentWhere, isTeacherRole, schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

import type { TimelineInput } from "./logic";

type User = NonNullable<CurrentUser>;

const NOTHING = { id: "__none__" } as const;

// Transfers a user may read. The origin and the destination school, the
// family of the pupil, and the territory above both schools (read only).
// A teacher follows the transfers of the pupils of their own classes.
export function transferWhere(user: User): Prisma.StudentTransferWhereInput {
  const s = user.scope;
  if (s.level === "SELF") {
    if (user.guardianId) return { student: { guardians: { some: { guardianId: user.guardianId } } } };
    if (user.studentId) return { studentId: user.studentId };
    return NOTHING;
  }
  if (isTeacherRole(user)) return { student: { enrollments: { some: enrollmentWhere(user) } } };
  if (s.level === "SCHOOL") return s.schoolId ? { OR: [{ fromSchoolId: s.schoolId }, { toSchoolId: s.schoolId }] } : NOTHING;
  const inScope = schoolWhere(user);
  return { OR: [{ fromSchool: inScope }, { toSchool: inScope }] };
}

export type TransferDirection = "outgoing" | "incoming" | "all";

export async function listTransfers(
  user: User,
  opts: { direction: TransferDirection; status: TransferStatus | "PENDING" | "ALL"; kind: TransferKind | "ALL"; q: string; skip: number; take: number },
) {
  const schoolId = user.scope.level === "SCHOOL" ? user.scope.schoolId : null;
  const where: Prisma.StudentTransferWhereInput = {
    AND: [
      transferWhere(user),
      schoolId && opts.direction === "outgoing" ? { fromSchoolId: schoolId } : {},
      // A class change stays in the school: it is listed with the outgoing
      // ones, never as incoming.
      schoolId && opts.direction === "incoming" ? { toSchoolId: schoolId, kind: "SCHOOL_CHANGE" } : {},
      opts.status === "ALL" ? {} : opts.status === "PENDING" ? { status: { in: ["PENDING_GUARDIAN", "PENDING_DESTINATION"] } } : { status: opts.status },
      opts.kind === "ALL" ? {} : { kind: opts.kind },
      opts.q
        ? {
            OR: [
              { student: { lastName: { contains: opts.q, mode: "insensitive" } } },
              { student: { firstName: { contains: opts.q, mode: "insensitive" } } },
              { student: { matricule: { contains: opts.q, mode: "insensitive" } } },
              { fromSchool: { name: { contains: opts.q, mode: "insensitive" } } },
              { toSchool: { name: { contains: opts.q, mode: "insensitive" } } },
            ],
          }
        : {},
    ],
  };
  const [rows, total] = await Promise.all([
    db.studentTransfer.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: opts.skip,
      take: opts.take,
      select: {
        id: true,
        kind: true,
        status: true,
        reason: true,
        createdAt: true,
        fromSchoolId: true,
        toSchoolId: true,
        fromClassroomId: true,
        toClassroomId: true,
        shareHistory: true,
        student: { select: { id: true, firstName: true, lastName: true, matricule: true, photoFileId: true } },
        fromSchool: { select: { name: true, commune: { select: { name: true } } } },
        toSchool: { select: { name: true, commune: { select: { name: true } } } },
      },
    }),
    db.studentTransfer.count({ where }),
  ]);
  const classNames = await classroomNames(rows.flatMap((r) => [r.fromClassroomId, r.toClassroomId]));
  return { rows: rows.map((r) => ({ ...r, fromClassroom: classNames.get(r.fromClassroomId) ?? null, toClassroom: r.toClassroomId ? (classNames.get(r.toClassroomId) ?? null) : null })), total };
}

// Counts for the tab badges: what waits for this school.
export async function pendingCounts(user: User) {
  const schoolId = user.scope.level === "SCHOOL" ? user.scope.schoolId : null;
  if (!schoolId) return { incoming: 0, outgoing: 0 };
  const [incoming, outgoing] = await Promise.all([
    db.studentTransfer.count({ where: { toSchoolId: schoolId, kind: "SCHOOL_CHANGE", status: "PENDING_DESTINATION" } }),
    db.studentTransfer.count({ where: { fromSchoolId: schoolId, kind: "SCHOOL_CHANGE", status: { in: ["PENDING_GUARDIAN", "PENDING_DESTINATION"] } } }),
  ]);
  return { incoming, outgoing };
}

async function classroomNames(ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((v): v is string => !!v))];
  if (!unique.length) return new Map<string, string>();
  const rows = await db.classroom.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } });
  return new Map(rows.map((r) => [r.id, r.name]));
}

async function peopleByIds(ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((v): v is string => !!v))];
  if (!unique.length) return new Map<string, { name: string; role: string; scopeLevel: string; schoolId: string | null }>();
  const rows = await db.user.findMany({ where: { id: { in: unique } }, select: { id: true, firstName: true, lastName: true, scopeLevel: true, schoolId: true, role: { select: { name: true } } } });
  return new Map(rows.map((u) => [u.id, { name: `${u.firstName} ${u.lastName}`, role: u.role.name, scopeLevel: u.scopeLevel, schoolId: u.schoolId }]));
}

// One transfer with everything its page shows, or null when it does not
// exist or is outside the user's reach (same answer, ids cannot be probed).
export async function getTransfer(user: User, id: string) {
  if (typeof id !== "string" || id.length > 64) return null;
  const t = await db.studentTransfer.findFirst({
    where: { AND: [{ id }, transferWhere(user)] },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          matricule: true,
          gender: true,
          birthDate: true,
          photoFileId: true,
          guardians: { orderBy: { isPrimary: "desc" }, select: { isPrimary: true, relationship: true, guardian: { select: { id: true, firstName: true, lastName: true, phone: true, userId: true } } } },
        },
      },
      fromSchool: { select: { id: true, name: true, commune: { select: { name: true, department: { select: { name: true } } } } } },
      toSchool: { select: { id: true, name: true, commune: { select: { name: true, department: { select: { name: true } } } } } },
    },
  });
  if (!t) return null;
  const [classes, people] = await Promise.all([
    classroomNames([t.fromClassroomId, t.toClassroomId]),
    peopleByIds([t.requestedById, t.guardianDecisionById, t.decidedById]),
  ]);
  const person = (uid: string | null) => (uid ? (people.get(uid) ?? null) : null);
  const guardianBy = person(t.guardianDecisionById);
  const timeline: TimelineInput = {
    kind: t.kind,
    status: t.status,
    createdAt: t.createdAt,
    requestedBy: person(t.requestedById),
    fromSchool: t.fromSchool.name,
    fromClassroom: classes.get(t.fromClassroomId) ?? null,
    toSchool: t.toSchool.name,
    toClassroom: t.toClassroomId ? (classes.get(t.toClassroomId) ?? null) : null,
    guardianDecidedAt: t.guardianDecidedAt,
    guardianDecisionBy: guardianBy,
    guardianRecordedByStaff: !!guardianBy && guardianBy.scopeLevel !== "SELF",
    decidedAt: t.decidedAt,
    decidedBy: person(t.decidedById),
    decisionNote: t.decisionNote,
  };
  return { transfer: t, fromClassroom: timeline.fromClassroom, toClassroom: timeline.toClassroom, timeline };
}

export type TransferDetail = NonNullable<Awaited<ReturnType<typeof getTransfer>>>;

// The pupil's current enrollment in the user's school, for the transfer
// form, with the other classes of the year.
export async function transferContext(user: User, studentId: string) {
  const year = await getActiveYear();
  if (!year || typeof studentId !== "string" || studentId.length > 64) return null;
  const enrollment = await db.enrollment.findFirst({
    where: { AND: [{ studentId, academicYearId: year.id, status: "ACTIVE" }, enrollmentWhere(user)] },
    select: {
      id: true,
      schoolId: true,
      classroomId: true,
      classroom: { select: { name: true, level: { select: { id: true, name: true, order: true } } } },
      school: { select: { name: true, cycle: true } },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          matricule: true,
          photoFileId: true,
          guardians: { where: { isPrimary: true }, take: 1, select: { guardian: { select: { firstName: true, lastName: true, phone: true, userId: true } } } },
        },
      },
    },
  });
  if (!enrollment) return null;
  const [classes, pending] = await Promise.all([
    db.classroom.findMany({
      where: { schoolId: enrollment.schoolId, academicYearId: year.id, id: { not: enrollment.classroomId } },
      orderBy: [{ level: { order: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, capacity: true, level: { select: { id: true, name: true } }, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
    }),
    db.studentTransfer.findFirst({ where: { studentId, status: { in: ["PENDING_GUARDIAN", "PENDING_DESTINATION"] } }, select: { id: true, toSchool: { select: { name: true } } } }),
  ]);
  return { year, enrollment, classes, pending };
}

// Destination schools, searched by name, commune or department. The
// national directory of open schools: a name and a place, nothing else.
export async function searchSchools(opts: { q: string; excludeId: string; take?: number }) {
  const q = opts.q.trim();
  if (q.length < 2) return [];
  return db.school.findMany({
    where: {
      id: { not: opts.excludeId },
      status: "ACTIVE",
      isActive: true,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { commune: { name: { contains: q, mode: "insensitive" } } },
        { commune: { department: { name: { contains: q, mode: "insensitive" } } } },
      ],
    },
    orderBy: [{ name: "asc" }],
    take: opts.take ?? 12,
    select: { id: true, name: true, cycle: true, sector: true, commune: { select: { name: true, department: { select: { name: true } } } } },
  });
}

// Classes of the destination school for the active year, to place the pupil.
export async function destinationClasses(schoolId: string) {
  const year = await getActiveYear();
  if (!year) return [];
  return db.classroom.findMany({
    where: { schoolId, academicYearId: year.id },
    orderBy: [{ level: { order: "asc" } }, { name: "asc" }],
    select: { id: true, name: true, capacity: true, level: { select: { name: true } }, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
  });
}

// The level the pupil is in at the origin, to preselect a matching class.
export async function originLevelName(classroomId: string) {
  const c = await db.classroom.findUnique({ where: { id: classroomId }, select: { level: { select: { name: true } } } });
  return c?.level.name ?? null;
}

// Transfers waiting for this guardian's answer, for the family space.
export async function awaitingGuardian(user: User) {
  if (!user.guardianId) return [];
  return db.studentTransfer.findMany({
    where: { status: "PENDING_GUARDIAN", student: { guardians: { some: { guardianId: user.guardianId, isPrimary: true } } } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      reason: true,
      createdAt: true,
      student: { select: { id: true, firstName: true, lastName: true, photoFileId: true } },
      fromSchool: { select: { name: true } },
      toSchool: { select: { name: true, commune: { select: { name: true } } } },
    },
  });
}

// Transfers of one pupil, for the history and the family space.
export async function transfersOfStudent(user: User, studentId: string) {
  const rows = await db.studentTransfer.findMany({
    where: { AND: [{ studentId }, transferWhere(user)] },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      kind: true,
      status: true,
      createdAt: true,
      decidedAt: true,
      fromSchoolId: true,
      toSchoolId: true,
      fromClassroomId: true,
      toClassroomId: true,
      fromSchool: { select: { name: true } },
      toSchool: { select: { name: true } },
    },
  });
  const names = await classroomNames(rows.flatMap((r) => [r.fromClassroomId, r.toClassroomId]));
  return rows.map((r) => ({ ...r, fromClassroom: names.get(r.fromClassroomId) ?? null, toClassroom: r.toClassroomId ? (names.get(r.toClassroomId) ?? null) : null }));
}
