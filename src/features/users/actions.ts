"use server";

import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { canAssignRole, canAssignRoleOn, generateTemporaryPassword, SCOPE_LABELS, type ScopeLevel, type ScopeRef } from "@/lib/domain/rights";
import { DomainError } from "@/lib/errors";

import { communeRef, departmentRef, schoolRef, userScopeRef } from "../territory/scope";
import { actorOf, userScopeWhere } from "./queries";

type User = NonNullable<CurrentUser>;

const id = z.string().trim().min(1).max(64);

const createSchema = z.object({
  firstName: z.string().trim().min(2, "Prénom trop court.").max(80, "80 caractères maximum."),
  lastName: z.string().trim().min(2, "Nom trop court.").max(80, "80 caractères maximum."),
  email: z.string().trim().toLowerCase().max(200).pipe(z.email("Adresse e-mail invalide.")),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || /^[0-9+ ]{8,20}$/.test(v), "Numéro invalide : chiffres, espaces et + uniquement."),
  roleId: z.string().trim().min(1, "Choisissez un rôle.").max(64),
  entityId: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((v) => v || null),
});

// Resolves the entity chosen for a role into its position in the territory.
async function resolveTarget(level: ScopeLevel, entityId: string | null): Promise<{ ref: ScopeRef; label: string }> {
  if (level === "NATIONAL") return { ref: { level: "NATIONAL" }, label: "Bénin" };
  if (!entityId) throw new DomainError("Choisissez le périmètre du compte.");
  const found = level === "DEPARTMENT" ? await departmentRef(entityId) : level === "COMMUNE" ? await communeRef(entityId) : level === "SCHOOL" ? await schoolRef(entityId) : null;
  if (!found) throw new DomainError("Périmètre introuvable.");
  return { ref: found.ref, label: found.entity.name };
}

export const createUser = createAction({
  permission: "user:create",
  schema: createSchema,
  handler: async (input, user) => {
    const role = await db.role.findUnique({
      where: { id: input.roleId },
      select: { id: true, name: true, code: true, scopeLevel: true, permissions: { select: { permission: { select: { code: true } } } } },
    });
    if (!role) throw new DomainError("Rôle introuvable.");
    if (role.scopeLevel === "SELF") throw new DomainError("Les comptes parent et élève se créent depuis la fiche de l'élève.");

    const target = await resolveTarget(role.scopeLevel, input.entityId);
    const rule = canAssignRoleOn(
      { ...actorOf(user), scope: userScopeRef(user) },
      { scopeLevel: role.scopeLevel, permissions: role.permissions.map((p) => p.permission.code) },
      target.ref,
    );
    if (!rule.ok) {
      await audit(user, { action: "denied", resource: "user", summary: `Création refusée : rôle ${role.name} sur ${target.label}`, metadata: { reason: rule.reason } });
      throw new DomainError(rule.reason);
    }

    const password = generateTemporaryPassword();
    try {
      const created = await db.user.create({
        data: {
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          passwordHash: await hashPassword(password),
          mustChangePassword: true,
          roleId: role.id,
          scopeLevel: role.scopeLevel,
          departmentId: role.scopeLevel === "DEPARTMENT" ? target.ref.departmentId : null,
          communeId: role.scopeLevel === "COMMUNE" ? target.ref.communeId : null,
          schoolId: role.scopeLevel === "SCHOOL" ? target.ref.schoolId : null,
        },
        select: { id: true, email: true },
      });
      await audit(user, {
        action: "create",
        resource: "user",
        resourceId: created.id,
        schoolId: target.ref.schoolId ?? null,
        summary: `Création du compte ${created.email} : ${role.name}, ${SCOPE_LABELS[role.scopeLevel].toLowerCase()} ${target.label}`,
        metadata: { role: role.code, scopeLevel: role.scopeLevel },
      });
      return { message: "Compte créé.", data: { email: created.email, password } };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new DomainError("Un compte existe déjà avec cette adresse e-mail.");
      throw error;
    }
  },
});

// A managed account: inside the actor's territory, not the actor's own, and
// holding a role the actor could assign. Resetting the password of a more
// powerful account would otherwise be a way to take it over.
async function manageableTarget(user: User, targetId: string) {
  const target = await db.user.findFirst({
    where: { AND: [{ id: targetId }, userScopeWhere(user)] },
    select: {
      id: true,
      email: true,
      isActive: true,
      schoolId: true,
      role: { select: { name: true, scopeLevel: true, permissions: { select: { permission: { select: { code: true } } } } } },
    },
  });
  if (!target) throw new DomainError("Compte introuvable dans votre périmètre.");
  if (target.id === user.id) throw new DomainError("Utilisez « Mon compte » pour votre propre compte.");
  const rule = canAssignRole(actorOf(user), { scopeLevel: target.role.scopeLevel, permissions: target.role.permissions.map((p) => p.permission.code) });
  if (!rule.ok) throw new DomainError(`Ce compte (${target.role.name}) a plus de droits que vous : vous ne pouvez pas le gérer.`);
  return target;
}

export const setUserActive = createAction({
  permission: "user:update",
  schema: z.object({ id, active: z.enum(["true", "false"]).transform((v) => v === "true") }),
  handler: async ({ id, active }, user) => {
    const target = await manageableTarget(user, id);
    await db.$transaction([
      db.user.update({ where: { id: target.id }, data: { isActive: active, ...(active ? { failedLoginCount: 0, lockedUntil: null } : {}) } }),
      // A deactivated account loses its open sessions at once.
      ...(active ? [] : [db.session.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } })]),
    ]);
    await audit(user, {
      action: active ? "activate" : "deactivate",
      resource: "user",
      resourceId: target.id,
      schoolId: target.schoolId,
      summary: `${active ? "Réactivation" : "Désactivation"} du compte ${target.email}`,
    });
    return active ? `Le compte ${target.email} est réactivé.` : `Le compte ${target.email} est désactivé et ses sessions sont fermées.`;
  },
});

export const resetUserPassword = createAction({
  permission: "user:update",
  schema: z.object({ id }),
  handler: async ({ id }, user) => {
    const target = await manageableTarget(user, id);
    const password = generateTemporaryPassword();
    const passwordHash = await hashPassword(password);
    await db.$transaction([
      db.user.update({ where: { id: target.id }, data: { passwordHash, mustChangePassword: true, failedLoginCount: 0, lockedUntil: null } }),
      db.session.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await audit(user, {
      action: "reset_password",
      resource: "user",
      resourceId: target.id,
      schoolId: target.schoolId,
      summary: `Réinitialisation du mot de passe de ${target.email}, sessions fermées`,
    });
    return { message: "Mot de passe réinitialisé.", data: { email: target.email, password } };
  },
});

export const revokeUserSessions = createAction({
  permission: "user:update",
  schema: z.object({ id }),
  handler: async ({ id }, user) => {
    const target = await manageableTarget(user, id);
    const { count } = await db.session.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit(user, {
      action: "revoke_sessions",
      resource: "user",
      resourceId: target.id,
      schoolId: target.schoolId,
      summary: `Fermeture de ${count} session${count > 1 ? "s" : ""} de ${target.email}`,
    });
    return count ? `${count} session${count > 1 ? "s" : ""} fermée${count > 1 ? "s" : ""}.` : "Aucune session ouverte.";
  },
});
