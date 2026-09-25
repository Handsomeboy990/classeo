import "server-only";

import { forbidden, notFound } from "next/navigation";

import { ForbiddenError } from "@/lib/auth/authorize";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isWithinScope, type ScopeRef } from "@/lib/domain/rights";

type User = NonNullable<CurrentUser>;

// A territorial position statistics are computed for.
export type StatScope =
  | { level: "NATIONAL" }
  | { level: "DEPARTMENT"; id: string }
  | { level: "COMMUNE"; id: string }
  | { level: "SCHOOL"; id: string };

export function userScopeRef(user: User): ScopeRef {
  return {
    level: user.scope.level,
    departmentId: user.scope.departmentId,
    communeId: user.scope.communeId,
    schoolId: user.scope.schoolId,
  };
}

// The user's own position. Null for parents and students, who have no
// territorial statistics.
export function userStatScope(user: User): StatScope | null {
  const s = user.scope;
  switch (s.level) {
    case "NATIONAL":
      return { level: "NATIONAL" };
    case "DEPARTMENT":
      return s.departmentId ? { level: "DEPARTMENT", id: s.departmentId } : null;
    case "COMMUNE":
      return s.communeId ? { level: "COMMUNE", id: s.communeId } : null;
    case "SCHOOL":
      return s.schoolId ? { level: "SCHOOL", id: s.schoolId } : null;
    case "SELF":
      return null;
  }
}

// Same format as scopeKey() in lib/auth/scope.ts, so a cache entry computed
// for a scope is shared by every user of that scope and by drill downs.
export function statScopeKey(scope: StatScope) {
  switch (scope.level) {
    case "NATIONAL":
      return "nation";
    case "DEPARTMENT":
      return `dep:${scope.id}`;
    case "COMMUNE":
      return `com:${scope.id}`;
    case "SCHOOL":
      return `sch:${scope.id}`;
  }
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const validId = (id: string | null | undefined): id is string => !!id && ID.test(id);

export async function departmentRef(id: string) {
  if (!validId(id)) return null;
  const d = await db.department.findUnique({ where: { id }, select: { id: true, name: true, code: true } });
  return d ? { entity: d, ref: { level: "DEPARTMENT", departmentId: d.id } satisfies ScopeRef } : null;
}

export async function communeRef(id: string) {
  if (!validId(id)) return null;
  const c = await db.commune.findUnique({
    where: { id },
    select: { id: true, name: true, departmentId: true, department: { select: { id: true, name: true } } },
  });
  return c ? { entity: c, ref: { level: "COMMUNE", departmentId: c.departmentId, communeId: c.id } satisfies ScopeRef } : null;
}

export async function schoolRef(id: string) {
  if (!validId(id)) return null;
  const s = await db.school.findUnique({
    where: { id },
    select: { id: true, name: true, communeId: true, commune: { select: { id: true, name: true, departmentId: true, department: { select: { id: true, name: true } } } } },
  });
  return s
    ? { entity: s, ref: { level: "SCHOOL", departmentId: s.commune.departmentId, communeId: s.communeId, schoolId: s.id } satisfies ScopeRef }
    : null;
}

// Page guards: a missing id renders 404, an id outside the user's territory
// renders 403. Territory pages also refuse a position above the user's own
// level: a communal inspector cannot open their whole department.
export async function requireDepartmentInScope(user: User, id: string) {
  const found = await departmentRef(id);
  if (!found) notFound();
  if (!isWithinScope(userScopeRef(user), found.ref)) forbidden();
  return found.entity;
}

export async function requireCommuneInScope(user: User, id: string) {
  const found = await communeRef(id);
  if (!found) notFound();
  if (!isWithinScope(userScopeRef(user), found.ref)) forbidden();
  return found.entity;
}

export async function requireSchoolInScope(user: User, id: string) {
  const found = await schoolRef(id);
  if (!found) notFound();
  if (!isWithinScope(userScopeRef(user), found.ref)) forbidden();
  return found.entity;
}

// Narrows the user's statistics scope with optional filters (department,
// then commune, then school), each checked against the user's territory.
// An id outside the territory throws; an unknown id is ignored.
export async function narrowStatScope(
  user: User,
  filters: { departmentId?: string | null; communeId?: string | null; schoolId?: string | null },
): Promise<{ scope: StatScope; departmentId: string | null; communeId: string | null; schoolId: string | null }> {
  const base = userStatScope(user);
  if (!base) throw new ForbiddenError("Aucune statistique territoriale pour ce compte.");
  const me = userScopeRef(user);
  let scope: StatScope = base;
  let departmentId: string | null = user.scope.departmentId;
  let communeId: string | null = user.scope.level === "NATIONAL" || user.scope.level === "DEPARTMENT" ? null : user.scope.communeId;
  const schoolId: string | null = user.scope.level === "SCHOOL" ? user.scope.schoolId : null;

  if (filters.schoolId && user.scope.level !== "SCHOOL") {
    const s = await schoolRef(filters.schoolId);
    if (s) {
      if (!isWithinScope(me, s.ref)) throw new ForbiddenError("Cet établissement est hors de votre périmètre.");
      return { scope: { level: "SCHOOL", id: s.entity.id }, departmentId: s.ref.departmentId, communeId: s.ref.communeId, schoolId: s.entity.id };
    }
  }
  if (filters.communeId && (user.scope.level === "NATIONAL" || user.scope.level === "DEPARTMENT")) {
    const c = await communeRef(filters.communeId);
    if (c) {
      if (!isWithinScope(me, c.ref)) throw new ForbiddenError("Cette commune est hors de votre périmètre.");
      // A commune that does not belong to the chosen department is ignored,
      // which happens when the department filter changes.
      if (!filters.departmentId || filters.departmentId === c.entity.departmentId) {
        scope = { level: "COMMUNE", id: c.entity.id };
        departmentId = c.entity.departmentId;
        communeId = c.entity.id;
        return { scope, departmentId, communeId, schoolId };
      }
    }
  }
  if (filters.departmentId && user.scope.level === "NATIONAL") {
    const d = await departmentRef(filters.departmentId);
    if (d) {
      scope = { level: "DEPARTMENT", id: d.entity.id };
      departmentId = d.entity.id;
    }
  }
  return { scope, departmentId: scope.level === "NATIONAL" ? null : departmentId, communeId, schoolId };
}
