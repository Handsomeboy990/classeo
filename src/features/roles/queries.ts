import "server-only";

import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { NOT_MAILBOX_ROLE, userScopeWhere } from "../users/queries";

type User = NonNullable<CurrentUser>;

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
      where: NOT_MAILBOX_ROLE,
      select: { id: true, code: true, name: true, description: true, scopeLevel: true, isSystem: true, updatedAt: true, permissions: { select: { permission: { select: { code: true } } } } },
      orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
      take: 500,
    }),
    db.user.groupBy({ by: ["roleId"], where: userScopeWhere(user), _count: { _all: true } }),
    db.user.groupBy({ by: ["roleId"], _count: { _all: true } }),
  ]);
  const changes = await lastChanges(roles.map((r) => r.id));
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
    permissions: r.permissions.map((p) => p.permission.code).sort(),
    users: byRole.get(r.id) ?? 0,
    // Whether accounts outside the viewer's territory hold the role, which
    // forbids its deletion. Their number is not exposed.
    heldOutsideScope: (totalByRole.get(r.id) ?? 0) > (byRole.get(r.id) ?? 0),
    lastChange: changes.get(r.id) ?? null,
  }));
}
