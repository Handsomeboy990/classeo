"use server";

import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { communeWhere, schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { invalidate, tags } from "@/lib/cache";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";

import { defaultPeriodicity, type Periodicity } from "@/lib/domain/periodicity";

import { CYCLES, SECTORS, type Cycle, type Sector } from "./labels";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum.`)
    .optional()
    .transform((v) => v || null);

const schoolFields = z.object({
  name: z.string().trim().min(3, "Le nom doit compter au moins 3 caractères.").max(150, "150 caractères maximum."),
  sector: z.enum(SECTORS, "Choisissez un secteur."),
  cycle: z.enum(CYCLES, "Choisissez un cycle."),
  communeId: z.string().trim().min(1, "Choisissez une commune.").max(64),
  address: optionalText(200),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || /^[0-9+ ]{8,20}$/.test(v), "Numéro invalide : chiffres, espaces et + uniquement."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || z.email().safeParse(v).success, "Adresse e-mail invalide."),
  // Empty: the national rule for the sector and cycle. Only the ministry
  // may choose another periodicity for a school.
  periodicity: z
    .enum(["", "TRIMESTER", "SEMESTER"])
    .optional()
    .transform((v) => (v ? v : null)),
});

// The evaluation periodicity a write sets: the ministry's choice when it
// makes one, otherwise the national rule for the sector and cycle.
function periodicityFor(user: NonNullable<CurrentUser>, input: { periodicity: Periodicity | null; sector: Sector; cycle: Cycle }): Periodicity {
  if (input.periodicity && user.scope.level !== "NATIONAL") throw new DomainError("Seul le ministère fixe la périodicité d'évaluation d'un établissement.");
  return input.periodicity ?? defaultPeriodicity(input);
}

async function communeInScope(user: NonNullable<CurrentUser>, communeId: string) {
  const commune = await db.commune.findFirst({ where: { AND: [{ id: communeId }, communeWhere(user)] }, select: { id: true, name: true } });
  if (!commune) throw new DomainError("Cette commune est hors de votre périmètre.");
  return commune;
}

async function nextSchoolCode() {
  const last = await db.school.findFirst({ where: { code: { startsWith: "BJ-" } }, orderBy: { code: "desc" }, select: { code: true } });
  const n = last ? Number.parseInt(last.code.slice(3), 10) || 0 : 0;
  return `BJ-${String(n + 1).padStart(4, "0")}`;
}

function invalidateSchool(id: string) {
  invalidate(tags.schools, tags.school(id), tags.stats, tags.territory);
}

export const createSchool = createAction({
  permission: "school:create",
  schema: schoolFields,
  handler: async (input, user) => {
    const commune = await communeInScope(user, input.communeId);
    // Two creations at the same instant may compute the same code: the unique
    // constraint refuses the second, which is retried once.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const school = await db.school.create({
          data: { ...input, periodicity: periodicityFor(user, input), communeId: commune.id, code: await nextSchoolCode() },
          select: { id: true, code: true, name: true },
        });
        await audit(user, {
          action: "create",
          resource: "school",
          resourceId: school.id,
          schoolId: school.id,
          summary: `Création de l'établissement ${school.name} (${school.code}) à ${commune.name}`,
        });
        invalidateSchool(school.id);
        return { message: `Établissement ${school.name} créé.`, data: { id: school.id } };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt === 0) continue;
        throw error;
      }
    }
    throw new DomainError("Création impossible pour le moment, réessayez.");
  },
});

export const updateSchool = createAction({
  permission: "school:update",
  schema: schoolFields.extend({ id: z.string().min(1).max(64) }),
  handler: async ({ id, ...input }, user) => {
    const school = await db.school.findFirst({ where: { AND: [{ id }, schoolWhere(user)] }, select: { id: true, name: true, communeId: true, sector: true, cycle: true, periodicity: true } });
    if (!school) throw new DomainError("Établissement introuvable dans votre périmètre.");
    const commune = await communeInScope(user, input.communeId);
    // Kept as is unless the ministry chooses, or the sector or the cycle
    // changes (the national rule then applies again).
    const changed = school.sector !== input.sector || school.cycle !== input.cycle;
    const periodicity = input.periodicity || changed ? periodicityFor(user, input) : school.periodicity;
    await db.school.update({ where: { id: school.id }, data: { ...input, periodicity, communeId: commune.id } });
    await audit(user, {
      action: "update",
      resource: "school",
      resourceId: school.id,
      schoolId: school.id,
      summary: `Modification de l'établissement ${input.name}`,
      metadata: school.communeId !== commune.id ? { movedFrom: school.communeId, movedTo: commune.id } : undefined,
    });
    invalidateSchool(school.id);
    return "Établissement mis à jour.";
  },
});
