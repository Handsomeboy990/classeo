import "server-only";

import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";
import { can, ForbiddenError } from "@/lib/auth/authorize";
import { classroomWhere, isTeacherRole, schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  allowedTargetLevels,
  managerReach,
  MAX_RECIPIENTS,
  membershipsOf,
  parseTargetValue,
  readerGroups,
  recipientLevel,
  type Position,
  type Reach,
  type ReaderGroup,
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

// Where the students behind these enrollments study this year.
async function positions(where: Prisma.EnrollmentWhereInput): Promise<Position[]> {
  const rows = await db.enrollment.findMany({
    where: { AND: [where, { academicYearId: await activeYearId(), status: "ACTIVE" }] },
    select: { classroomId: true, schoolId: true, school: { select: { communeId: true, commune: { select: { departmentId: true } } } } },
  });
  return rows.map((r) => ({ classroomId: r.classroomId, schoolId: r.schoolId, communeId: r.school.communeId, departmentId: r.school.commune.departmentId }));
}

// A guardian link counts whatever the account's level: a teacher can also
// be the parent of a pupil.
const childrenPositions = cache(async (user: User) => (user.guardianId ? positions({ student: { guardians: { some: { guardianId: user.guardianId } } } }) : []));
const ownPosition = cache(async (user: User) => (user.studentId ? ((await positions({ studentId: user.studentId }))[0] ?? null) : null));

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
    isPartner: user.role.code === "PARTNER",
    teacherClassroomIds: await teacherClassroomIds(user),
  };
}

export async function membershipsFor(user: User) {
  const [p, children, own] = await Promise.all([profile(user), childrenPositions(user), ownPosition(user)]);
  return membershipsOf({ ...p, children, own });
}

export async function managerReachFor(user: User) {
  return managerReach(await profile(user));
}

const NATIONAL_TARGET: Prisma.ContentWhereInput = { departmentId: null, communeId: null, schoolId: null, classroomId: null };

// Mirrors readerGroupMatches() from the domain rules: the most specific
// target decides, so every clause pins the more specific ids to null.
function groupWhere(g: ReaderGroup): Prisma.ContentWhereInput {
  const or: Prisma.ContentWhereInput[] = [NATIONAL_TARGET];
  if (g.departments.length) or.push({ departmentId: { in: g.departments }, communeId: null, schoolId: null, classroomId: null });
  if (g.communes.length) or.push({ communeId: { in: g.communes }, schoolId: null, classroomId: null });
  if (g.schools.length) or.push({ schoolId: { in: g.schools }, classroomId: null });
  if (g.classrooms.length) or.push({ classroomId: { in: g.classrooms } });
  return { audience: { in: g.audiences }, OR: or };
}

// Published contents addressed to the user: inside the target and in the
// audience, for the same membership. This is what the list shows by
// default, what the ticker scrolls and what notifications announce.
export async function receivedWhere(user: User): Promise<Prisma.ContentWhereInput> {
  const groups = readerGroups(await membershipsFor(user));
  if (!groups.length) return { id: "__none__" };
  return { status: "PUBLISHED", OR: groups.map(groupWhere) };
}

// Management reach as a database filter (see isInReach()).
export function reachWhere(reach: Reach): Prisma.ContentWhereInput {
  // Explicit "every row": an empty {} inside an OR matches nothing in Prisma.
  if (reach.all) return { id: { not: "" } };
  const { exact, subtree } = reach;
  const or: Prisma.ContentWhereInput[] = [];
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

// Contents the user may manage: their own, or any whose target is inside
// their management reach, whatever the status and the audience.
export async function manageableWhere(user: User): Promise<Prisma.ContentWhereInput> {
  return { OR: [{ authorId: user.id }, reachWhere(await managerReachFor(user))] };
}

// Contents a user may follow as a supervisor or an author ("managed" view).
async function managedWhere(user: User): Promise<Prisma.ContentWhereInput> {
  return can(user, "content:update") ? manageableWhere(user) : { authorId: user.id };
}

// A detail page opens for what the user received and for what they manage.
export async function visibleWhere(user: User): Promise<Prisma.ContentWhereInput> {
  return { OR: [await receivedWhere(user), await managedWhere(user)] };
}

// Whether the user has a "managed" view at all.
export function canFollowManaged(user: User) {
  return can(user, "content:create") || can(user, "content:update");
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

export type ContentView = "received" | "managed";

export type ContentFilters = {
  view: ContentView;
  type?: "ANNOUNCEMENT" | "RESOURCE" | "EVENT";
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  q: string;
  skip: number;
  take: number;
};

export async function listContents(user: User, f: ContentFilters) {
  const managed = f.view === "managed" && canFollowManaged(user);
  const and: Prisma.ContentWhereInput[] = [managed ? await managedWhere(user) : await receivedWhere(user)];
  if (f.type) and.push({ type: f.type });
  if (managed && f.status) and.push({ status: f.status });
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

// The scrolling band: published contents addressed to the user, flagged for
// the ticker and not expired. Never what the user only supervises.
export async function listTickerContents(user: User, now = new Date()) {
  return db.content.findMany({
    where: { AND: [await receivedWhere(user), { ticker: true }, { OR: [{ tickerUntil: null }, { tickerUntil: { gt: now } }] }] },
    select: { id: true, title: true, easyRead: true, type: true, publishedAt: true },
    orderBy: { publishedAt: "desc" },
    take: 5,
  });
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
  if (levels.includes("CLASSROOM")) out.push(...(await classOptions(user)));
  return out;
}

async function classOptions(user: User): Promise<TargetOption[]> {
  const where: Prisma.ClassroomWhereInput = isTeacher(user)
    ? { AND: [classroomWhere(user), { academicYearId: await activeYearId() }] }
    : { schoolId: user.scope.schoolId ?? "__none__", academicYearId: await activeYearId() };
  const classes = await db.classroom.findMany({ where, select: { id: true, name: true, level: { select: { order: true } } }, orderBy: [{ level: { order: "asc" } }, { name: "asc" }] });
  return classes.map((c) => ({ value: `CLASSROOM:${c.id}`, label: `Classe ${c.name}`, group: "Classes" }));
}

// Explicit recipients an author may pick instead of one target: specific
// schools of their territory, or specific classes of their school.
export async function recipientOptions(user: User): Promise<TargetOption[]> {
  const level = recipientLevel(user.scope.level);
  if (level === "CLASSROOM") return classOptions(user);
  if (level !== "SCHOOL") return [];
  const schools = await db.school.findMany({
    where: { AND: [schoolWhere(user), { isActive: true }] },
    select: { id: true, name: true, commune: { select: { name: true } } },
    orderBy: [{ commune: { name: "asc" } }, { name: "asc" }],
    take: 2000,
  });
  return schools.map((x) => ({ value: `SCHOOL:${x.id}`, label: x.name, group: x.commune.name }));
}

const OUT_OF_SCOPE = "Cette cible est hors de votre périmètre.";

// Checks explicit recipients against the author's territory and returns one
// target per recipient. Scoped lookups: every id must be found or the write
// fails as a whole.
export async function resolveRecipientsForWrite(user: User, values: string[]): Promise<Required<TargetIds>[]> {
  const level = recipientLevel(user.scope.level);
  const unique = [...new Set(values)];
  if (!level || unique.length > MAX_RECIPIENTS) throw new ForbiddenError(OUT_OF_SCOPE);
  const parsed = unique.map(parseTargetValue);
  if (parsed.some((p) => !p || p.level !== level)) throw new ForbiddenError(OUT_OF_SCOPE);
  const ids = parsed.map((p) => p!.id!);
  const none = { departmentId: null, communeId: null, schoolId: null, classroomId: null };
  if (level === "SCHOOL") {
    const found = await db.school.findMany({ where: { AND: [{ id: { in: ids } }, schoolWhere(user)] }, select: { id: true } });
    if (found.length !== ids.length) throw new ForbiddenError(OUT_OF_SCOPE);
    return ids.map((schoolId) => ({ ...none, schoolId }));
  }
  const where: Prisma.ClassroomWhereInput = isTeacher(user)
    ? { AND: [{ id: { in: ids } }, classroomWhere(user), { academicYearId: await activeYearId() }] }
    : { id: { in: ids }, schoolId: user.scope.schoolId ?? "__none__" };
  const rooms = await db.classroom.findMany({ where, select: { id: true, schoolId: true } });
  if (rooms.length !== ids.length) throw new ForbiddenError(OUT_OF_SCOPE);
  const bySchool = new Map(rooms.map((r) => [r.id, r.schoolId]));
  return ids.map((classroomId) => ({ ...none, schoolId: bySchool.get(classroomId)!, classroomId }));
}

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
