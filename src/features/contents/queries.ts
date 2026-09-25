import "server-only";

import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";
import { can, ForbiddenError } from "@/lib/auth/authorize";
import { classroomWhere, isTeacherRole } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  allowedTargetLevels,
  audiencesOf,
  managerReach,
  parseTargetValue,
  readerReach,
  type Position,
  type Reach,
  type TargetIds,
} from "@/lib/domain/content-targeting";

type User = NonNullable<CurrentUser>;

export const activeYearId = cache(async () => {
  const year = await db.academicYear.findFirst({ where: { isActive: true }, select: { id: true } });
  return year?.id ?? "__none__";
});

// Classes the teacher teaches or leads this year.
const teacherClassroomIds = cache(async (user: User) => {
  if (!user.teacherId) return [];
  const rows = await db.classroom.findMany({ where: { AND: [classroomWhere(user), { academicYearId: await activeYearId() }] }, select: { id: true } });
  return rows.map((r) => r.id);
});

// Where the user's children (guardian) or the user (student) study this year.
const familyPositions = cache(async (user: User): Promise<Position[]> => {
  if (user.scope.level !== "SELF") return [];
  const who: Prisma.EnrollmentWhereInput | null = user.guardianId
    ? { student: { guardians: { some: { guardianId: user.guardianId } } } }
    : user.studentId
      ? { studentId: user.studentId }
      : null;
  if (!who) return [];
  const rows = await db.enrollment.findMany({
    where: { AND: [who, { academicYearId: await activeYearId(), status: "ACTIVE" }] },
    select: { classroomId: true, schoolId: true, school: { select: { communeId: true, commune: { select: { departmentId: true } } } } },
  });
  return rows.map((r) => ({ classroomId: r.classroomId, schoolId: r.schoolId, communeId: r.school.communeId, departmentId: r.school.commune.departmentId }));
});

// Role based, like the scope filters: an unlinked teacher account manages
// no class rather than the whole school.
const isTeacher = isTeacherRole;

async function profile(user: User) {
  return {
    level: user.scope.level,
    departmentId: user.scope.departmentId,
    communeId: user.scope.communeId,
    schoolId: user.scope.schoolId,
    isTeacher: isTeacher(user),
    teacherClassroomIds: await teacherClassroomIds(user),
  };
}

export async function readerReachFor(user: User) {
  return readerReach({ ...(await profile(user)), family: await familyPositions(user) });
}

export async function managerReachFor(user: User) {
  return managerReach(await profile(user));
}

export function audiencesFor(user: User) {
  return audiencesOf({
    level: user.scope.level,
    isTeacher: isTeacher(user),
    isGuardian: !!user.guardianId,
    isStudent: !!user.studentId,
    isPartner: user.role.code === "PARTNER",
  });
}

const NATIONAL_TARGET: Prisma.ContentWhereInput = { departmentId: null, communeId: null, schoolId: null, classroomId: null };

// Mirrors isInReach() from the domain rules as a database filter: the most
// specific target decides, so every clause pins the more specific ids to null.
export function reachWhere(reach: Reach, { includeNational }: { includeNational: boolean }): Prisma.ContentWhereInput {
  // Explicit "every row": an empty {} inside an OR matches nothing in Prisma.
  if (reach.all) return { id: { not: "" } };
  const { exact, subtree } = reach;
  const or: Prisma.ContentWhereInput[] = [];
  if (includeNational) or.push(NATIONAL_TARGET);
  if (exact.departments.length) or.push({ departmentId: { in: exact.departments }, communeId: null, schoolId: null, classroomId: null });
  if (exact.communes.length) or.push({ communeId: { in: exact.communes }, schoolId: null, classroomId: null });
  if (exact.schools.length) or.push({ schoolId: { in: exact.schools }, classroomId: null });
  if (exact.classrooms.length) or.push({ classroomId: { in: exact.classrooms } });
  if (subtree.departments.length) {
    const d = { in: subtree.departments };
    or.push(
      { departmentId: d, communeId: null, schoolId: null, classroomId: null },
      { commune: { departmentId: d }, schoolId: null, classroomId: null },
      { school: { commune: { departmentId: d } }, classroomId: null },
      { classroom: { school: { commune: { departmentId: d } } } },
    );
  }
  if (subtree.communes.length) {
    const c = { in: subtree.communes };
    or.push({ communeId: c, schoolId: null, classroomId: null }, { school: { communeId: c }, classroomId: null }, { classroom: { school: { communeId: c } } });
  }
  if (subtree.schools.length) {
    const s = { in: subtree.schools };
    or.push({ schoolId: s, classroomId: null }, { classroom: { schoolId: s } });
  }
  return or.length ? { OR: or } : { id: "__none__" };
}

// Contents the user may manage with the given permission: their own, or any
// whose target is inside their management reach.
export async function manageableWhere(user: User): Promise<Prisma.ContentWhereInput> {
  return { OR: [{ authorId: user.id }, reachWhere(await managerReachFor(user), { includeNational: false })] };
}

// Everything the user may read: published contents in reach for their
// audience, their own contents, and, for editors, every content they manage.
export async function visibleWhere(user: User): Promise<Prisma.ContentWhereInput> {
  const or: Prisma.ContentWhereInput[] = [
    { AND: [{ status: "PUBLISHED" }, { audience: { in: audiencesFor(user) } }, reachWhere(await readerReachFor(user), { includeNational: true })] },
    { authorId: user.id },
  ];
  if (can(user, "content:update")) or.push(reachWhere(await managerReachFor(user), { includeNational: false }));
  return { OR: or };
}

export type TickerItem = { id: string; title: string; summary: string | null; type: "ANNOUNCEMENT" | "RESOURCE" | "EVENT" };

// Important announcements shown as a scrolling band on the screens of their
// audience: published, marked for the band, before its end date, and
// readable by this user under the same rules as the list (audience and
// reach). Drafts and the author's own unpublished work never scroll.
export async function tickerContents(user: User): Promise<TickerItem[]> {
  const rows = await db.content.findMany({
    where: {
      AND: [
        { status: "PUBLISHED", ticker: true, tickerUntil: { gt: new Date() } },
        { audience: { in: audiencesFor(user) } },
        reachWhere(await readerReachFor(user), { includeNational: true }),
      ],
    },
    select: { id: true, title: true, easyRead: true, type: true },
    orderBy: { publishedAt: "desc" },
    take: 6,
  });
  return rows.map((r) => ({ id: r.id, title: r.title, summary: r.easyRead, type: r.type }));
}

export const contentInclude = {
  author: { select: { firstName: true, lastName: true, role: { select: { name: true } } } },
  department: { select: { name: true } },
  commune: { select: { name: true } },
  school: { select: { name: true } },
  classroom: { select: { name: true, school: { select: { name: true } } } },
} satisfies Prisma.ContentInclude;

export type ContentRow = Prisma.ContentGetPayload<{ include: typeof contentInclude }>;

export function targetLabel(c: Pick<ContentRow, "department" | "commune" | "school" | "classroom">) {
  if (c.classroom) return `Classe ${c.classroom.name}, ${c.classroom.school.name}`;
  if (c.school) return c.school.name;
  if (c.commune) return `Commune de ${c.commune.name}`;
  if (c.department) return `Département ${c.department.name}`;
  return "National, tout le Bénin";
}

export type ContentFilters = { type?: "ANNOUNCEMENT" | "RESOURCE" | "EVENT"; status?: "DRAFT" | "PUBLISHED" | "ARCHIVED"; q: string; skip: number; take: number };

export async function listContents(user: User, f: ContentFilters) {
  const and: Prisma.ContentWhereInput[] = [await visibleWhere(user)];
  if (f.type) and.push({ type: f.type });
  if (f.status) and.push({ status: f.status });
  if (f.q)
    and.push({
      OR: [
        { title: { contains: f.q, mode: "insensitive" } },
        { easyRead: { contains: f.q, mode: "insensitive" } },
        { body: { contains: f.q, mode: "insensitive" } },
      ],
    });
  const where = { AND: and };
  const [rows, total] = await Promise.all([
    db.content.findMany({
      where,
      include: contentInclude,
      orderBy: [{ publishedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
      skip: f.skip,
      take: f.take,
    }),
    db.content.count({ where }),
  ]);
  return { rows, total };
}

export async function getVisibleContent(user: User, id: string) {
  return db.content.findFirst({ where: { AND: [{ id }, await visibleWhere(user)] }, include: contentInclude });
}

export async function getManageableContent(user: User, id: string) {
  return db.content.findFirst({ where: { AND: [{ id }, await manageableWhere(user)] }, include: contentInclude });
}

// Ids of the contents in a list the user may manage, to show edit controls.
export async function manageableIds(user: User, ids: string[]) {
  if (!ids.length || !can(user, "content:update")) return new Set<string>();
  const rows = await db.content.findMany({ where: { AND: [{ id: { in: ids } }, await manageableWhere(user)] }, select: { id: true } });
  return new Set(rows.map((r) => r.id));
}

export type TargetOption = { value: string; label: string; group: string };

// The targets an author may pick, limited to their own scope.
export async function targetOptions(user: User): Promise<TargetOption[]> {
  const levels = allowedTargetLevels(user.scope.level, isTeacher(user));
  const s = user.scope;
  const out: TargetOption[] = [];
  if (levels.includes("NATIONAL")) out.push({ value: "NATIONAL", label: "National, tout le Bénin", group: "Territoire" });
  if (levels.includes("DEPARTMENT")) {
    const deps = await db.department.findMany({
      where: s.level === "NATIONAL" ? {} : { id: s.departmentId ?? "__none__" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    out.push(...deps.map((d) => ({ value: `DEPARTMENT:${d.id}`, label: `Département ${d.name}`, group: "Départements" })));
  }
  if (levels.includes("COMMUNE")) {
    const communes = await db.commune.findMany({
      where: s.level === "DEPARTMENT" ? { departmentId: s.departmentId ?? "__none__" } : { id: s.communeId ?? "__none__" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    out.push(...communes.map((c) => ({ value: `COMMUNE:${c.id}`, label: `Commune de ${c.name}`, group: "Communes" })));
  }
  if (levels.includes("SCHOOL")) {
    const schools = await db.school.findMany({
      where: s.level === "COMMUNE" ? { communeId: s.communeId ?? "__none__", isActive: true } : { id: s.schoolId ?? "__none__" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    out.push(...schools.map((x) => ({ value: `SCHOOL:${x.id}`, label: x.name, group: "Établissements" })));
  }
  if (levels.includes("CLASSROOM")) {
    const where: Prisma.ClassroomWhereInput = isTeacher(user)
      ? { AND: [classroomWhere(user), { academicYearId: await activeYearId() }] }
      : { schoolId: s.schoolId ?? "__none__", academicYearId: await activeYearId() };
    const classes = await db.classroom.findMany({ where, select: { id: true, name: true, level: { select: { order: true } } }, orderBy: [{ level: { order: "asc" } }, { name: "asc" }] });
    out.push(...classes.map((c) => ({ value: `CLASSROOM:${c.id}`, label: `Classe ${c.name}`, group: "Classes" })));
  }
  return out;
}

const OUT_OF_SCOPE = "Cette cible est hors de votre périmètre.";

// Checks a submitted target against the author's scope and returns the ids
// to store. Every lookup is scoped: it must find the row or the write fails.
export async function resolveTargetForWrite(user: User, value: string): Promise<Required<TargetIds>> {
  const parsed = parseTargetValue(value);
  const none = { departmentId: null, communeId: null, schoolId: null, classroomId: null };
  if (!parsed || !allowedTargetLevels(user.scope.level, isTeacher(user)).includes(parsed.level)) throw new ForbiddenError(OUT_OF_SCOPE);
  const s = user.scope;
  const id = parsed.id ?? "";
  switch (parsed.level) {
    case "NATIONAL":
      return none;
    case "DEPARTMENT": {
      const found = await db.department.count({ where: s.level === "NATIONAL" ? { id } : { id, AND: { id: s.departmentId ?? "__none__" } } });
      if (!found) throw new ForbiddenError(OUT_OF_SCOPE);
      return { ...none, departmentId: id };
    }
    case "COMMUNE": {
      const found = await db.commune.count({ where: s.level === "DEPARTMENT" ? { id, departmentId: s.departmentId ?? "__none__" } : { id, AND: { id: s.communeId ?? "__none__" } } });
      if (!found) throw new ForbiddenError(OUT_OF_SCOPE);
      return { ...none, communeId: id };
    }
    case "SCHOOL": {
      const found = await db.school.count({ where: s.level === "COMMUNE" ? { id, communeId: s.communeId ?? "__none__" } : { id, AND: { id: s.schoolId ?? "__none__" } } });
      if (!found) throw new ForbiddenError(OUT_OF_SCOPE);
      return { ...none, schoolId: id };
    }
    case "CLASSROOM": {
      const where: Prisma.ClassroomWhereInput = isTeacher(user)
        ? { AND: [{ id }, classroomWhere(user), { academicYearId: await activeYearId() }] }
        : { id, schoolId: s.schoolId ?? "__none__" };
      const room = await db.classroom.findFirst({ where, select: { id: true, schoolId: true } });
      if (!room) throw new ForbiddenError(OUT_OF_SCOPE);
      return { ...none, schoolId: room.schoolId, classroomId: room.id };
    }
  }
}
