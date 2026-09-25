import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { canAssignRole, type ScopeLevel } from "@/lib/domain/rights";
import { param, type SearchParams } from "@/lib/list";

type User = NonNullable<CurrentUser>;

// Accounts a user may see: those attached to an entity inside their
// territory. Parents and students (no entity) are only visible nationally.
export function userScopeWhere(user: User): Prisma.UserWhereInput {
  const s = user.scope;
  switch (s.level) {
    case "NATIONAL":
      return {};
    case "DEPARTMENT":
      if (!s.departmentId) return { id: "__none__" };
      return { OR: [{ departmentId: s.departmentId }, { commune: { departmentId: s.departmentId } }, { school: { commune: { departmentId: s.departmentId } } }] };
    case "COMMUNE":
      if (!s.communeId) return { id: "__none__" };
      return { OR: [{ communeId: s.communeId }, { school: { communeId: s.communeId } }] };
    case "SCHOOL":
      return s.schoolId ? { schoolId: s.schoolId } : { id: "__none__" };
    case "SELF":
      return { id: "__none__" };
  }
}

export type UserFilters = { q: string; roleId: string | null; status: "active" | "inactive" | null };

export function userFilters(sp: SearchParams): UserFilters {
  const statut = param(sp, "statut");
  return {
    q: (param(sp, "q") ?? "").trim().slice(0, 100),
    roleId: param(sp, "role") || null,
    status: statut === "active" || statut === "inactive" ? statut : null,
  };
}

function listWhere(user: User, f: UserFilters): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [userScopeWhere(user)];
  if (f.q)
    and.push({
      OR: [
        { email: { contains: f.q, mode: "insensitive" } },
        { lastName: { contains: f.q, mode: "insensitive" } },
        { firstName: { contains: f.q, mode: "insensitive" } },
      ],
    });
  if (f.roleId) and.push({ roleId: f.roleId });
  if (f.status) and.push({ isActive: f.status === "active" });
  return { AND: and };
}

// Explicit columns: the password hash never leaves the database layer.
export function userListSelect(now: Date) {
  return {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    phone: true,
    isActive: true,
    mustChangePassword: true,
    lastLoginAt: true,
    lockedUntil: true,
    scopeLevel: true,
    createdAt: true,
    role: { select: { id: true, name: true, code: true, scopeLevel: true, permissions: { select: { permission: { select: { code: true } } } } } },
    department: { select: { name: true } },
    commune: { select: { name: true } },
    school: { select: { name: true } },
    _count: { select: { sessions: { where: { revokedAt: null, expiresAt: { gt: now } } } } },
  } satisfies Prisma.UserSelect;
}

export async function listUsers(user: User, f: UserFilters, page: { skip: number; take: number }) {
  const where = listWhere(user, f);
  const now = new Date();
  const [rows, total] = await Promise.all([
    db.user.findMany({ where, select: userListSelect(now), orderBy: [{ lastName: "asc" }, { firstName: "asc" }], skip: page.skip, take: page.take }),
    db.user.count({ where }),
  ]);
  return {
    total,
    rows: rows.map(({ role, ...u }) => ({
      ...u,
      role: { id: role.id, name: role.name, code: role.code },
      // The row actions are shown only when the server would accept them.
      manageable: u.id !== user.id && canAssignRole(actorOf(user), { scopeLevel: role.scopeLevel, permissions: role.permissions.map((p) => p.permission.code) }).ok,
    })),
  };
}

export function exportUsers(user: User, f: UserFilters) {
  return db.user.findMany({ where: listWhere(user, f), select: userListSelect(new Date()), orderBy: [{ lastName: "asc" }, { firstName: "asc" }], take: 10000 });
}

export function actorOf(user: User) {
  return { permissions: user.permissions, scopeLevel: user.scope.level as ScopeLevel };
}

// Roles the user may hand out: the anti escalation rule, and never a family
// role (parents and students are created with their student record).
export async function assignableRoles(user: User) {
  const roles = await db.role.findMany({
    where: { scopeLevel: { not: "SELF" } },
    select: { id: true, code: true, name: true, scopeLevel: true, permissions: { select: { permission: { select: { code: true } } } } },
    orderBy: { name: "asc" },
  });
  return roles
    .filter((r) => canAssignRole(actorOf(user), { scopeLevel: r.scopeLevel, permissions: r.permissions.map((p) => p.permission.code) }).ok)
    .map((r) => ({ id: r.id, code: r.code, name: r.name, scopeLevel: r.scopeLevel }));
}

export function roleFilterOptions() {
  return db.role.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
}

// Entities of the user's territory, for the scope select of the create form.
export async function entityOptions(user: User) {
  const s = user.scope;
  const [departments, communes, schools] = await Promise.all([
    s.level === "NATIONAL" || s.level === "DEPARTMENT"
      ? db.department.findMany({ where: s.level === "NATIONAL" ? {} : { id: s.departmentId ?? "__none__" }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    s.level === "NATIONAL" || s.level === "DEPARTMENT" || s.level === "COMMUNE"
      ? db.commune.findMany({
          where: s.level === "NATIONAL" ? {} : s.level === "DEPARTMENT" ? { departmentId: s.departmentId ?? "__none__" } : { id: s.communeId ?? "__none__" },
          select: { id: true, name: true, department: { select: { name: true } } },
          orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
        })
      : Promise.resolve([]),
    db.school.findMany({
      where: schoolWhere(user),
      select: { id: true, name: true, commune: { select: { name: true } } },
      orderBy: [{ commune: { name: "asc" } }, { name: "asc" }],
    }),
  ]);
  return {
    DEPARTMENT: departments.map((d) => ({ id: d.id, label: d.name })),
    COMMUNE: communes.map((c) => ({ id: c.id, label: c.name, group: c.department.name })),
    SCHOOL: schools.map((sc) => ({ id: sc.id, label: sc.name, group: sc.commune.name })),
  };
}
