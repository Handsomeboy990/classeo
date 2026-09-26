import "server-only";

import { cache } from "react";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { isoToDate, todayIso } from "@/lib/domain/attendance";
import { db } from "@/lib/db";
import { periodsOf, type Periodicity } from "@/lib/domain/periodicity";
import { DomainError } from "@/lib/errors";

// Academic calendar helpers shared by every pedagogy module (classes,
// students, grades, report cards, attendance).

export const getActiveYear = cache(async () =>
  db.academicYear.findFirst({ where: { isActive: true }, include: { periods: { orderBy: [{ periodicity: "asc" }, { order: "asc" }] } } }),
);

export async function requireActiveYear() {
  const year = await getActiveYear();
  if (!year) throw new DomainError("Aucune année scolaire active. Contactez l'administrateur.");
  return year;
}

// The evaluation periodicity of the school a session works in. A school
// session always has one; other accounts fall back to terms, the national
// calendar's own division.
export function userPeriodicity(user: { scope: { periodicity?: Periodicity | null } }): Periodicity {
  return user.scope.periodicity ?? "TRIMESTER";
}

// Periods of the active year in the given periodicity, in order.
export const getYearPeriods = cache(async (periodicity: Periodicity) => {
  const year = await getActiveYear();
  return year ? periodsOf(year.periods, periodicity) : [];
});

// The period containing today, otherwise the first one still open, otherwise
// the last one.
export function pickCurrentPeriod<P extends { startDate: Date; endDate: Date; isClosed: boolean }>(periods: P[], today = isoToDate(todayIso())): P | null {
  if (!periods.length) return null;
  return periods.find((p) => p.startDate <= today && today <= p.endDate) ?? periods.find((p) => !p.isClosed) ?? periods[periods.length - 1]!;
}

export const getCurrentPeriod = cache(async (periodicity: Periodicity) => pickCurrentPeriod(await getYearPeriods(periodicity)));

// A school's periodicity, for pages reached from outside the school (a
// student record, a family view).
export const schoolPeriodicity = cache(async (schoolId: string): Promise<Periodicity> => {
  const school = await db.school.findUnique({ where: { id: schoolId }, select: { periodicity: true } });
  return school?.periodicity ?? "TRIMESTER";
});

export function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// ---------------------------------------------------------------------------
// zod helpers for form data
// ---------------------------------------------------------------------------

export const id = z.string({ error: "Champ obligatoire." }).trim().min(1, "Champ obligatoire.").max(64);

export const optionalId = z
  .string()
  .trim()
  .max(64)
  .optional()
  .transform((v) => v || null);

export const optionalText = (max = 120) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères au maximum.`)
    .optional()
    .transform((v) => v || null);

export const requiredText = (max = 80) => z.string({ error: "Champ obligatoire." }).trim().min(1, "Champ obligatoire.").max(max, `${max} caractères au maximum.`);

export const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
  .optional()
  .transform((v) => v === true || v === "on" || v === "true");

export const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s.-]/g, ""))
  .pipe(z.string().regex(/^\+?\d{8,15}$/, "Numéro de téléphone invalide (8 à 15 chiffres)."));

export const optionalPhone = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.replace(/[\s.-]/g, "") : null))
  .pipe(z.string().regex(/^\+?\d{8,15}$/, "Numéro de téléphone invalide (8 à 15 chiffres).").nullable());

export const intIn = (min: number, max: number, label = "La valeur") =>
  z.coerce
    .number({ error: "Nombre attendu." })
    .int("Nombre entier attendu.")
    .min(min, `${label} doit être au moins ${min}.`)
    .max(max, `${label} doit être au plus ${max}.`);
