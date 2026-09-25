"use server";

import { z } from "zod";

import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { invalidate, tags } from "@/lib/cache";
import { db } from "@/lib/db";
import { planRoleUpdate } from "@/lib/domain/rights";
import { DomainError } from "@/lib/errors";

import { actorOf } from "../users/queries";

export const updateRolePermissions = createAction({
  permission: "role:update",
  schema: z.object({
    roleId: z.string().trim().min(1).max(64),
    permissions: z.array(z.string().max(40)).max(PERMISSIONS.length).default([]),
  }),
  handler: async ({ roleId, permissions }, user) => {
    const role = await db.role.findUnique({
      where: { id: roleId },
      select: { id: true, code: true, name: true, scopeLevel: true, permissions: { select: { permission: { select: { code: true } } } } },
    });
    if (!role) throw new DomainError("Rôle introuvable.");

    const plan = planRoleUpdate({
      actor: actorOf(user),
      role: { code: role.code, scopeLevel: role.scopeLevel },
      current: role.permissions.map((p) => p.permission.code),
      submitted: permissions,
      catalogue: PERMISSIONS.map((p) => p.code),
    });
    if (!plan.ok) {
      await audit(user, { action: "denied", resource: "role", resourceId: role.id, summary: `Modification refusée du rôle ${role.name}`, metadata: { reason: plan.reason } });
      throw new DomainError(plan.reason);
    }
    if (!plan.added.length && !plan.removed.length) return "Aucun changement à enregistrer.";

    const rows = await db.permission.findMany({ where: { code: { in: [...plan.added, ...plan.removed] } }, select: { id: true, code: true } });
    const idOf = new Map(rows.map((r) => [r.code, r.id]));
    await db.$transaction([
      db.rolePermission.deleteMany({ where: { roleId: role.id, permissionId: { in: plan.removed.map((c) => idOf.get(c)!).filter(Boolean) } } }),
      db.rolePermission.createMany({ data: plan.added.map((c) => ({ roleId: role.id, permissionId: idOf.get(c)! })), skipDuplicates: true }),
      // Touch the role so its "last change" date is right.
      db.role.update({ where: { id: role.id }, data: { updatedAt: new Date() } }),
    ]);

    await audit(user, {
      action: "update",
      resource: "role",
      resourceId: role.id,
      schoolId: null,
      summary: `Droits du rôle ${role.name} : ${plan.added.length} ajouté${plan.added.length > 1 ? "s" : ""}, ${plan.removed.length} retiré${plan.removed.length > 1 ? "s" : ""}`,
      metadata: { added: plan.added, removed: plan.removed },
    });
    // Permissions are read from the database on every request, so the change
    // applies to every holder of the role from their next page.
    invalidate(tags.roles);
    return `Droits du rôle ${role.name} enregistrés (${plan.added.length} ajout${plan.added.length > 1 ? "s" : ""}, ${plan.removed.length} retrait${plan.removed.length > 1 ? "s" : ""}).`;
  },
});
