"use server";

import { randomBytes } from "node:crypto";

import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/auth/permissions";
import type { CurrentUser } from "@/lib/auth/session";
import { invalidate, tags } from "@/lib/cache";
import { db } from "@/lib/db";
import { canEditRoleDetails, customRoleCode, planRoleCreate, planRoleDeletion, planRoleUpdate, sameRoleName, SCOPE_LABELS, type ScopeLevel } from "@/lib/domain/rights";
import { DomainError } from "@/lib/errors";

import { actorOf, userScopeWhere } from "../users/queries";
import { canManageRole, canReceiveHolders, creatableLevels, isNationalRole, ownerFor, type RoleOwner } from "./ownership";
import { actorScope, roleVisibleWhere } from "./queries";

type User = NonNullable<CurrentUser>;

const roleId = z.string().trim().min(1).max(64);
const roleName = z.string().trim().min(3, "3 caractères minimum.").max(60, "60 caractères maximum.").transform((v) => v.replace(/\s+/g, " "));
const roleDescription = z.string().trim().max(300, "300 caractères maximum.").default("");
const optionalId = z
  .string()
  .trim()
  .max(64)
  .optional()
  .transform((v) => v || null);

const roleWithPermissions = {
  id: true,
  code: true,
  name: true,
  description: true,
  scopeLevel: true,
  isSystem: true,
  ownerSchoolId: true,
  ownerCommuneId: true,
  ownerDepartmentId: true,
  permissions: { select: { permission: { select: { code: true } } } },
} as const;

const ownerOf = (r: RoleOwner): RoleOwner => ({ ownerSchoolId: r.ownerSchoolId, ownerCommuneId: r.ownerCommuneId, ownerDepartmentId: r.ownerDepartmentId });

// A role the user may see, or nothing: an identifier of another school's
// role reads as unknown.
function findVisibleRole(user: User, id: string) {
  return db.role.findFirst({ where: { AND: [{ id }, roleVisibleWhere(user)] }, select: roleWithPermissions });
}

const codesOf = (r: { permissions: { permission: { code: string } }[] }) => r.permissions.map((p) => p.permission.code);

// Role names are what people pick from a list: two roles may not share one,
// whatever the case or accents. An entity's role is compared with the
// national roles and the entity's other roles (two schools may both have a
// "Surveillant général"); a national role with every role.
async function assertNameFree(name: string, owner: RoleOwner, exceptId?: string) {
  const among: Prisma.RoleWhereInput = isNationalRole(owner) ? {} : { OR: [{ ownerSchoolId: null, ownerCommuneId: null, ownerDepartmentId: null }, owner] };
  const others = await db.role.findMany({ where: { AND: [among, exceptId ? { id: { not: exceptId } } : {}] }, select: { name: true }, take: 1000 });
  if (others.some((o) => sameRoleName(o.name, name))) throw new DomainError("Un rôle porte déjà ce nom. Choisissez-en un autre.");
}

async function refuse(user: User, summary: string, reason: string, resourceId?: string): Promise<never> {
  await audit(user, { action: "denied", resource: "role", resourceId: resourceId ?? null, schoolId: user.scope.level === "SCHOOL" ? user.scope.schoolId : null, summary, metadata: { reason } });
  throw new DomainError(reason);
}

export const createRole = createAction({
  permission: "role:update",
  schema: z.object({
    name: roleName,
    description: roleDescription,
    scopeLevel: z.enum(["NATIONAL", "DEPARTMENT", "COMMUNE", "SCHOOL"], { error: "Choisissez un niveau." }),
    sourceRoleId: optionalId,
  }),
  handler: async (input, user) => {
    const source = input.sourceRoleId ? await findVisibleRole(user, input.sourceRoleId) : null;
    if (input.sourceRoleId && !source) throw new DomainError("Le rôle à copier est introuvable.");
    // A school, a commune or a department owns the roles it creates.
    const owner = ownerFor(actorScope(user));
    if (!owner) return refuse(user, `Création refusée du rôle ${input.name}`, "Votre compte ne peut pas créer de rôle.");
    if (!creatableLevels(actorScope(user)).includes(input.scopeLevel as ScopeLevel))
      return refuse(user, `Création refusée du rôle ${input.name} (${SCOPE_LABELS[input.scopeLevel]})`, "Vous créez des rôles pour votre propre niveau uniquement.");

    const plan = planRoleCreate({
      actor: actorOf(user),
      scopeLevel: input.scopeLevel as ScopeLevel,
      source: source ? codesOf(source) : null,
      catalogue: PERMISSIONS.map((p) => p.code),
    });
    if (!plan.ok) return refuse(user, `Création refusée du rôle ${input.name} (${SCOPE_LABELS[input.scopeLevel]})`, plan.reason);
    await assertNameFree(input.name, owner);

    const permissionRows = await db.permission.findMany({ where: { code: { in: plan.permissions } }, select: { id: true } });
    let created: { id: string; name: string };
    try {
      created = await db.role.create({
        data: {
          code: customRoleCode(input.name, randomBytes(3).toString("hex")),
          name: input.name,
          description: input.description,
          scopeLevel: input.scopeLevel,
          isSystem: false,
          ...owner,
          permissions: { create: permissionRows.map((p) => ({ permissionId: p.id })) },
        },
        select: { id: true, name: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new DomainError("Ce rôle n'a pas pu être créé. Réessayez.");
      throw error;
    }

    const count = plan.permissions.length;
    await audit(user, {
      action: "create",
      resource: "role",
      resourceId: created.id,
      schoolId: owner.ownerSchoolId,
      summary: `Création du rôle ${created.name} (${SCOPE_LABELS[input.scopeLevel].toLowerCase()})${source ? `, copié de ${source.name}` : ""} : ${count} droit${count > 1 ? "s" : ""}`,
      metadata: { scopeLevel: input.scopeLevel, source: source?.code ?? null, permissions: plan.permissions, dropped: plan.dropped, owner },
    });
    invalidate(tags.roles);

    const dropped = plan.dropped.length;
    const message = dropped
      ? `Rôle ${created.name} créé avec ${count} droit${count > 1 ? "s" : ""}. ${dropped} droit${dropped > 1 ? "s" : ""} du rôle ${source!.name} que vous ne détenez pas ${dropped > 1 ? "n'ont" : "n'a"} pas été copié${dropped > 1 ? "s" : ""}.`
      : `Rôle ${created.name} créé avec ${count} droit${count > 1 ? "s" : ""}.`;
    return { message, data: { id: created.id } };
  },
});

export const updateRoleDetails = createAction({
  permission: "role:update",
  schema: z.object({ roleId, name: roleName, description: roleDescription }),
  handler: async (input, user) => {
    const role = await findVisibleRole(user, input.roleId);
    if (!role) throw new DomainError("Rôle introuvable.");
    const managed = canManageRole(actorScope(user), role);
    if (!managed.ok) return refuse(user, `Modification refusée du rôle ${role.name}`, managed.reason, role.id);
    const rule = canEditRoleDetails(actorOf(user), role);
    if (!rule.ok) return refuse(user, `Modification refusée du rôle ${role.name}`, rule.reason, role.id);
    if (role.name === input.name && role.description === input.description) return "Aucun changement à enregistrer.";
    if (role.name !== input.name) await assertNameFree(input.name, ownerOf(role), role.id);

    await db.role.update({ where: { id: role.id }, data: { name: input.name, description: input.description } });
    await audit(user, {
      action: "update",
      resource: "role",
      resourceId: role.id,
      schoolId: role.ownerSchoolId,
      summary: role.name === input.name ? `Description du rôle ${role.name} modifiée` : `Rôle ${role.name} renommé en ${input.name}`,
      metadata: { before: { name: role.name, description: role.description }, after: { name: input.name, description: input.description } },
    });
    invalidate(tags.roles);
    return `Rôle ${input.name} enregistré.`;
  },
});

export const deleteRole = createAction({
  permission: "role:update",
  schema: z.object({ roleId, targetRoleId: optionalId }),
  handler: async (input, user) => {
    const role = await findVisibleRole(user, input.roleId);
    if (!role) throw new DomainError("Rôle introuvable.");
    const managed = canManageRole(actorScope(user), role);
    if (!managed.ok) return refuse(user, `Suppression refusée du rôle ${role.name}`, managed.reason, role.id);
    const target = input.targetRoleId ? await findVisibleRole(user, input.targetRoleId) : null;
    if (input.targetRoleId && !target) throw new DomainError("Le rôle d'accueil est introuvable.");
    if (target) {
      const fits = canReceiveHolders(role, target);
      if (!fits.ok) return refuse(user, `Suppression refusée du rôle ${role.name}`, fits.reason, role.id);
    }

    const [total, inScope] = await Promise.all([
      db.user.count({ where: { roleId: role.id } }),
      db.user.count({ where: { AND: [{ roleId: role.id }, userScopeWhere(user)] } }),
    ]);
    const plan = planRoleDeletion({
      actor: actorOf(user),
      role: { id: role.id, isSystem: role.isSystem, scopeLevel: role.scopeLevel, permissions: codesOf(role) },
      holders: { total, inScope },
      target: target ? { id: target.id, scopeLevel: target.scopeLevel, permissions: codesOf(target) } : null,
    });
    if (!plan.ok) return refuse(user, `Suppression refusée du rôle ${role.name}`, plan.reason, role.id);

    const changed = "Les comptes de ce rôle viennent de changer. Rechargez la page et recommencez.";
    let moved: number;
    try {
      moved = await db.$transaction(async (tx) => {
        // The holders are counted again inside the transaction: an account
        // attached in between would otherwise be moved without being checked.
        const now = await tx.user.count({ where: { roleId: role.id } });
        if (now !== total) throw new DomainError(changed);
        const { count } = plan.move && target ? await tx.user.updateMany({ where: { roleId: role.id }, data: { roleId: target.id } }) : { count: 0 };
        await tx.role.delete({ where: { id: role.id } });
        return count;
      });
    } catch (error) {
      // An account attached after the second count: the database refuses to
      // delete a role still in use.
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2003" || error.code === "P2025")) throw new DomainError(changed);
      throw error;
    }

    await audit(user, {
      action: "delete",
      resource: "role",
      resourceId: role.id,
      schoolId: role.ownerSchoolId,
      summary: moved && target ? `Suppression du rôle ${role.name}, ${moved} compte${moved > 1 ? "s" : ""} déplacé${moved > 1 ? "s" : ""} vers ${target.name}` : `Suppression du rôle ${role.name}`,
      metadata: { code: role.code, scopeLevel: role.scopeLevel, permissions: codesOf(role), movedTo: target?.code ?? null, moved },
    });
    if (moved && target)
      await audit(user, {
        action: "update",
        resource: "role",
        resourceId: target.id,
        schoolId: role.ownerSchoolId,
        summary: `${moved} compte${moved > 1 ? "s" : ""} du rôle supprimé ${role.name} rattaché${moved > 1 ? "s" : ""} à ${target.name}`,
        metadata: { from: role.code, moved },
      });
    invalidate(tags.roles);
    return moved && target
      ? `Rôle ${role.name} supprimé. ${moved} compte${moved > 1 ? "s" : ""} ${moved > 1 ? "ont" : "a"} désormais le rôle ${target.name}.`
      : `Rôle ${role.name} supprimé.`;
  },
});

export const updateRolePermissions = createAction({
  permission: "role:update",
  schema: z.object({
    roleId: z.string().trim().min(1).max(64),
    permissions: z.array(z.string().max(40)).max(PERMISSIONS.length).default([]),
  }),
  handler: async ({ roleId, permissions }, user) => {
    const role = await findVisibleRole(user, roleId);
    if (!role) throw new DomainError("Rôle introuvable.");
    // Outside the national level, only the roles of one's own entity change:
    // the national roles serve every school.
    const managed = canManageRole(actorScope(user), role);
    if (!managed.ok) return refuse(user, `Modification refusée du rôle ${role.name}`, managed.reason, role.id);

    const plan = planRoleUpdate({
      actor: actorOf(user),
      role: { code: role.code, scopeLevel: role.scopeLevel },
      current: role.permissions.map((p) => p.permission.code),
      submitted: permissions,
      catalogue: PERMISSIONS.map((p) => p.code),
    });
    if (!plan.ok) {
      return refuse(user, `Modification refusée du rôle ${role.name}`, plan.reason, role.id);
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
      schoolId: role.ownerSchoolId,
      summary: `Droits du rôle ${role.name} : ${plan.added.length} ajouté${plan.added.length > 1 ? "s" : ""}, ${plan.removed.length} retiré${plan.removed.length > 1 ? "s" : ""}`,
      metadata: { added: plan.added, removed: plan.removed },
    });
    // Permissions are read from the database on every request, so the change
    // applies to every holder of the role from their next page.
    invalidate(tags.roles);
    return `Droits du rôle ${role.name} enregistrés (${plan.added.length} ajout${plan.added.length > 1 ? "s" : ""}, ${plan.removed.length} retrait${plan.removed.length > 1 ? "s" : ""}).`;
  },
});
