import "server-only";

import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { userScopeWhere } from "../users/queries";

type User = NonNullable<CurrentUser>;

// Roles with their permission codes and the number of accounts holding each
// one inside the viewer's scope.
export async function listRolesWithCounts(user: User) {
  const [roles, counts] = await Promise.all([
    db.role.findMany({
      select: { id: true, code: true, name: true, description: true, scopeLevel: true, isSystem: true, updatedAt: true, permissions: { select: { permission: { select: { code: true } } } } },
      orderBy: [{ createdAt: "asc" }],
    }),
    db.user.groupBy({ by: ["roleId"], where: userScopeWhere(user), _count: { _all: true } }),
  ]);
  const byRole = new Map(counts.map((c) => [c.roleId, c._count._all]));
  return roles.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description,
    scopeLevel: r.scopeLevel,
    isSystem: r.isSystem,
    updatedAt: r.updatedAt,
    permissions: r.permissions.map((p) => p.permission.code).sort(),
    users: byRole.get(r.id) ?? 0,
  }));
}
