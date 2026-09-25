import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { userScopeWhere } from "../users/queries";
import { ownerFor, type ActorScope } from "./ownership";

type User = NonNullable<CurrentUser>;

export function actorScope(user: User): ActorScope {
  return { level: user.scope.level, departmentId: user.scope.departmentId, communeId: user.scope.communeId, schoolId: user.scope.schoolId };
}

const NATIONAL_ROLE = { ownerSchoolId: null, ownerCommuneId: null, ownerDepartmentId: null } satisfies Prisma.RoleWhereInput;

// Roles a user may see: the national roles, and those their own entity
// created. The national level sees every role.
export function roleVisibleWhere(user: User): Prisma.RoleWhereInput {
  if (user.scope.level === "NATIONAL") return {};
  const own = ownerFor(actorScope(user));
  return own ? { OR: [NATIONAL_ROLE, own] } : NATIONAL_ROLE;
}

export const roleOwnerSelect = {
  ownerSchoolId: true,
  ownerCommuneId: true,
  ownerDepartmentId: true,
  ownerSchool: { select: { name: true } },
} as const;

// Name of the entity owning a role, for the rights page. Communes and
// departments are not relations of Role, so their names are read here.
export async function ownerNames(roles: { ownerCommuneId: string | null; ownerDepartmentId: string | null }[]) {
  const communeIds = [...new Set(roles.map((r) => r.ownerCommuneId).filter((v): v is string => !!v))];
  const departmentIds = [...new Set(roles.map((r) => r.ownerDepartmentId).filter((v): v is string => !!v))];
  const [communes, departments] = await Promise.all([
    communeIds.length ? db.commune.findMany({ where: { id: { in: communeIds } }, select: { id: true, name: true } }) : [],
    departmentIds.length ? db.department.findMany({ where: { id: { in: departmentIds } }, select: { id: true, name: true } }) : [],
  ]);
  return new Map([...communes.map((c) => [c.id, `Commune ${c.name}`] as const), ...departments.map((d) => [d.id, `Département ${d.name}`] as const)]);
}

// Latest audited change of each role (creation, rights, renaming), with its
// author. Denied attempts are not changes.
async function lastChanges(roleIds: string[]) {
  if (!roleIds.length) return new Map<string, { at: Date; summary: string; by: string | null }>();
  const latest = await db.auditLog.groupBy({
    by: ["resourceId"],
    where: { resource: "role", resourceId: { in: roleIds }, action: { not: "denied" } },
    _max: { createdAt: true },
  });
  const pairs = latest.filter((l) => l.resourceId && l._max.createdAt).map((l) => ({ resourceId: l.resourceId!, createdAt: l._max.createdAt! }));
  if (!pairs.length) return new Map();
  const rows = await db.auditLog.findMany({
    where: { resource: "role", action: { not: "denied" }, OR: pairs },
    select: { resourceId: true, createdAt: true, summary: true, user: { select: { firstName: true, lastName: true } } },
    take: pairs.length * 2,
  });
  const out = new Map<string, { at: Date; summary: string; by: string | null }>();
  for (const r of rows) {
    if (!r.resourceId || out.has(r.resourceId)) continue;
    out.set(r.resourceId, { at: r.createdAt, summary: r.summary, by: r.user ? `${r.user.firstName} ${r.user.lastName}` : null });
  }
  return out;
}

// Roles with their permission codes, the number of accounts holding each one
// inside the viewer's scope and overall, and their last audited change.
export async function listRolesWithCounts(user: User) {
  const [roles, counts, totals] = await Promise.all([
    db.role.findMany({
      where: roleVisibleWhere(user),
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        scopeLevel: true,
        isSystem: true,
        updatedAt: true,
        ...roleOwnerSelect,
        permissions: { select: { permission: { select: { code: true } } } },
      },
      orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
      take: 500,
    }),
    db.user.groupBy({ by: ["roleId"], where: userScopeWhere(user), _count: { _all: true } }),
    db.user.groupBy({ by: ["roleId"], _count: { _all: true } }),
  ]);
  const [changes, names] = await Promise.all([lastChanges(roles.map((r) => r.id)), ownerNames(roles)]);
  const byRole = new Map(counts.map((c) => [c.roleId, c._count._all]));
  const totalByRole = new Map(totals.map((c) => [c.roleId, c._count._all]));
  return roles.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description,
    scopeLevel: r.scopeLevel,
    isSystem: r.isSystem,
    updatedAt: r.updatedAt,
    owner: { ownerSchoolId: r.ownerSchoolId, ownerCommuneId: r.ownerCommuneId, ownerDepartmentId: r.ownerDepartmentId },
    // Null for a national role.
    ownerName: r.ownerSchool?.name ?? (r.ownerCommuneId ? names.get(r.ownerCommuneId) : r.ownerDepartmentId ? names.get(r.ownerDepartmentId) : null) ?? null,
    permissions: r.permissions.map((p) => p.permission.code).sort(),
    users: byRole.get(r.id) ?? 0,
    // Whether accounts outside the viewer's territory hold the role, which
    // forbids its deletion. Their number is not exposed.
    heldOutsideScope: (totalByRole.get(r.id) ?? 0) > (byRole.get(r.id) ?? 0),
    lastChange: changes.get(r.id) ?? null,
  }));
}
