import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { can } from "@/lib/auth/authorize";
import { classroomWhere, enrollmentWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isoToDate, todayIso } from "@/lib/domain/attendance";
import { param, type SearchParams } from "@/lib/list";

import { activeYearId } from "../contents/queries";
import { familyDocWhere, staffDocWhere } from "./access";
import { ageOn, isHealthDoc, isKind, isStatus, refusalToSend, type FamilyDocKind, type FamilyDocStatus } from "./rules";

type User = NonNullable<CurrentUser>;

// ---------------------------------------------------------------------------
// Family side
// ---------------------------------------------------------------------------

const enrollmentSelect = {
  id: true,
  schoolId: true,
  academicYearId: true,
  classroom: { select: { name: true, levelId: true } },
  school: { select: { name: true } },
  student: { select: { id: true, firstName: true, lastName: true, birthDate: true } },
} satisfies Prisma.EnrollmentSelect;

// The children (or, for a student, the own enrollment) of the running year
// the account may send pieces for.
export async function familyEnrollments(user: User) {
  if (user.scope.level !== "SELF") return [];
  return db.enrollment.findMany({
    where: { AND: [enrollmentWhere(user), { academicYearId: await activeYearId(), status: "ACTIVE" }] },
    select: enrollmentSelect,
    orderBy: [{ student: { birthDate: "desc" } }],
  });
}

export type FamilyEnrollmentRow = Awaited<ReturnType<typeof familyEnrollments>>[number];

// Scoped lookup for a write: the child's active enrollment, found only
// through the account's own family links. A foreign id finds nothing.
export async function ownEnrollment(user: User, studentId: string) {
  if (user.scope.level !== "SELF" || studentId.length > 64) return null;
  return db.enrollment.findFirst({
    where: { AND: [enrollmentWhere(user), { studentId, academicYearId: await activeYearId(), status: "ACTIVE" }] },
    select: enrollmentSelect,
  });
}

// Pieces the school asks for this child: those of every level and those of
// the child's level, not withdrawn.
export function piecesFor(e: { schoolId: string; classroom: { levelId: string } }) {
  return db.requiredPiece.findMany({
    where: { schoolId: e.schoolId, archivedAt: null, OR: [{ levelId: null }, { levelId: e.classroom.levelId }] },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, label: true, description: true, isHealth: true },
  });
}

const docListSelect = {
  id: true,
  kind: true,
  status: true,
  requiredPieceId: true,
  attendanceId: true,
  startsOn: true,
  endsOn: true,
  note: true,
  reviewNote: true,
  reviewedAt: true,
  createdAt: true,
  fileId: true,
  fileRemovedAt: true,
  file: { select: { fileName: true, mimeType: true, size: true } },
  requiredPiece: { select: { label: true, isHealth: true } },
} satisfies Prisma.FamilyDocumentSelect;

export type FamilyDocRow = Prisma.FamilyDocumentGetPayload<{ select: typeof docListSelect }>;

// Everything the family page shows for one child.
export async function familyFile(user: User, e: FamilyEnrollmentRow, today = todayIso()) {
  const [pieces, docs, absences] = await Promise.all([
    piecesFor(e),
    db.familyDocument.findMany({ where: { AND: [familyDocWhere(user), { enrollmentId: e.id }] }, select: docListSelect, orderBy: { createdAt: "desc" } }),
    db.studentAttendance.findMany({
      where: { enrollmentId: e.id, status: { in: ["ABSENT", "EXCUSED"] } },
      select: { id: true, date: true, half: true, status: true, reason: true },
      orderBy: [{ date: "desc" }, { half: "asc" }],
      take: 60,
    }),
  ]);
  const isStudent = !user.guardianId;
  const age = ageOn(e.student.birthDate, isoToDate(today));
  return {
    pieces: pieces
      // A student never sees the health pieces: the parents handle them.
      .filter((p) => !(isStudent && p.isHealth))
      .map((p) => ({ ...p, docs: docs.filter((d) => d.requiredPieceId === p.id) })),
    absences: absences.map((a) => ({ ...a, docs: docs.filter((d) => d.attendanceId === a.id) })),
    medical: docs.filter((d) => d.kind === "MEDICAL"),
    // Why this account may not send, whatever the piece (a student under 16).
    blocked: refusalToSend(user, { health: false }, e.student, isoToDate(today)),
    age,
  };
}

// ---------------------------------------------------------------------------
// School side
// ---------------------------------------------------------------------------

export type StaffFilters = { kind: FamilyDocKind | null; status: FamilyDocStatus | null; q: string };

export function staffFilters(sp: SearchParams): StaffFilters {
  const type = param(sp, "type");
  const statut = param(sp, "statut");
  return {
    kind: isKind(type) ? type : null,
    // Default view: the pieces waiting for a decision.
    status: statut === "tous" ? null : isStatus(statut) ? statut : "PENDING",
    q: (param(sp, "q") ?? "").trim().slice(0, 100),
  };
}

const staffListSelect = {
  ...docListSelect,
  student: { select: { id: true, firstName: true, lastName: true } },
  enrollment: { select: { classroom: { select: { name: true } } } },
  attendance: { select: { date: true, half: true } },
  submittedBy: { select: { firstName: true, lastName: true, role: { select: { name: true } } } },
} satisfies Prisma.FamilyDocumentSelect;

export async function staffQueue(user: User, f: StaffFilters, page: { skip: number; take: number }) {
  const base = staffDocWhere(user);
  const and: Prisma.FamilyDocumentWhereInput[] = [base];
  if (f.kind) and.push({ kind: f.kind });
  if (f.status) and.push({ status: f.status });
  if (f.q) and.push({ student: { OR: [{ firstName: { contains: f.q, mode: "insensitive" } }, { lastName: { contains: f.q, mode: "insensitive" } }, { matricule: { contains: f.q, mode: "insensitive" } }] } });
  const where = { AND: and };
  const [rows, total, pending] = await Promise.all([
    db.familyDocument.findMany({ where, select: staffListSelect, orderBy: [{ createdAt: f.status === "PENDING" ? "asc" : "desc" }, { id: "asc" }], skip: page.skip, take: page.take }),
    db.familyDocument.count({ where }),
    db.familyDocument.groupBy({ by: ["kind"], where: { AND: [base, { status: "PENDING" }] }, _count: { _all: true } }),
  ]);
  const pendingByKind = { ENROLLMENT: 0, ABSENCE: 0, MEDICAL: 0 } as Record<FamilyDocKind, number>;
  for (const p of pending) pendingByKind[p.kind] = p._count._all;
  return { rows, total, pendingByKind };
}

export async function staffDoc(user: User, id: string) {
  if (id.length > 64) return null;
  const doc = await db.familyDocument.findFirst({
    where: { AND: [{ id }, staffDocWhere(user)] },
    select: {
      ...staffListSelect,
      schoolId: true,
      attendance: { select: { date: true, half: true, status: true, reason: true } },
      student: { select: { id: true, firstName: true, lastName: true, matricule: true } },
      reviewedBy: { select: { firstName: true, lastName: true } },
    },
  });
  return doc ? { ...doc, health: isHealthDoc(doc) } : null;
}

// Which kinds of pieces the user examines, for the filters of the queue.
export function reviewableKinds(user: User): FamilyDocKind[] {
  const general = can(user, "family_document:approve");
  const health = can(user, "health_document:approve");
  return [...(general || health ? (["ENROLLMENT"] as const) : []), ...(general ? (["ABSENCE"] as const) : []), ...(health ? (["MEDICAL"] as const) : [])];
}

// The list of pieces the school asks for, with the levels it teaches.
export async function schoolPieces(user: User) {
  const schoolId = user.scope.level === "SCHOOL" ? (user.scope.schoolId ?? "__none__") : "__none__";
  const [pieces, levels] = await Promise.all([
    db.requiredPiece.findMany({
      where: { schoolId, archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, label: true, description: true, isHealth: true, level: { select: { name: true } }, _count: { select: { documents: true } } },
    }),
    db.academicLevel.findMany({ where: { classrooms: { some: { schoolId, academicYearId: await activeYearId() } } }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
  ]);
  return { pieces, levels };
}

// EPS dispensations in force or to come for the students of a class the
// user may open: the name and the period only, never the certificate. An EPS
// teacher sees who is dispensed without seeing why.
export async function classDispensations(user: User, classroomId: string, today = todayIso()) {
  return db.familyDocument.findMany({
    where: {
      kind: "MEDICAL",
      status: "ACCEPTED",
      endsOn: { gte: isoToDate(today) },
      enrollment: { classroomId, status: "ACTIVE", classroom: classroomWhere(user) },
    },
    select: { id: true, startsOn: true, endsOn: true, student: { select: { firstName: true, lastName: true } } },
    orderBy: [{ startsOn: "asc" }],
  });
}
