"use server";

import { z } from "zod";

import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import type { CurrentUser } from "@/lib/auth/session";
import { invalidate, tags } from "@/lib/cache";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { isYearClosed } from "@/lib/guards";
import { periodName } from "@/lib/domain/periodicity";
import { formatDate } from "@/lib/utils";

import { grantExtension } from "./extensions";
import { calendarError, ISO_DATE, isoToUtc, overlaps, yearLabelError } from "./rules";

type User = NonNullable<CurrentUser>;

const id = z.string().trim().min(1, "Champ obligatoire.").max(64);
const isoDate = z.string({ error: "Date obligatoire." }).trim().regex(ISO_DATE, "Date invalide.");
const dates = z.array(isoDate).max(4);

// The calendar is national: only the ministry (national scope) writes it,
// whatever permissions a custom role carries.
function assertMinistry(user: User) {
  if (user.scope.level !== "NATIONAL") throw new DomainError("Le calendrier scolaire est fixé par le ministère.");
}

function invalidateCalendar() {
  invalidate(tags.stats, tags.schools);
}

const yearSchema = z.object({
  id: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((v) => v || null),
  label: z.string().trim().min(1, "Champ obligatoire.").max(20),
  startDate: isoDate,
  endDate: isoDate,
  periodName: z.array(z.string().trim().min(1, "Nom obligatoire.").max(40, "40 caractères au maximum.")).min(2, "Prévoyez au moins 2 périodes.").max(4, "4 périodes au maximum."),
  periodStart: dates,
  periodEnd: dates,
  semesterStart: z.array(isoDate).length(2, "Indiquez les dates des deux semestres."),
  semesterEnd: z.array(isoDate).length(2, "Indiquez les dates des deux semestres."),
});

export const saveYear = createAction({
  permission: "calendar:update",
  schema: yearSchema,
  handler: async (input, user) => {
    assertMinistry(user);
    if (!input.id && !user.permissions.has("calendar:create")) throw new DomainError("Vous n'avez pas le droit de créer une année scolaire.");
    const start = isoToUtc(input.startDate);
    const end = isoToUtc(input.endDate);
    if (input.periodStart.length !== input.periodName.length || input.periodEnd.length !== input.periodName.length) throw new DomainError("Chaque période a un nom, un début et une fin.");
    const terms = input.periodName.map((name, i) => ({ name, startDate: isoToUtc(input.periodStart[i]!), endDate: isoToUtc(input.periodEnd[i]!) }));
    const semesters = [0, 1].map((i) => ({ name: periodName("SEMESTER", i + 1), startDate: isoToUtc(input.semesterStart[i]!), endDate: isoToUtc(input.semesterEnd[i]!) }));
    const error = yearLabelError(input.label, start) ?? calendarError(start, end, terms) ?? calendarError(start, end, semesters);
    if (error) throw new DomainError(error);
    // Both sets, each numbered from 1 within its periodicity.
    const periods = [
      ...terms.map((p, i) => ({ ...p, periodicity: "TRIMESTER" as const, order: i + 1 })),
      ...semesters.map((p, i) => ({ ...p, periodicity: "SEMESTER" as const, order: i + 1 })),
    ];

    const others = await db.academicYear.findMany({ where: input.id ? { id: { not: input.id } } : {}, select: { label: true, startDate: true, endDate: true } });
    const clash = others.find((o) => o.label === input.label) ?? others.find((o) => overlaps(o, { startDate: start, endDate: end }));
    if (clash) throw new DomainError(clash.label === input.label ? `L'année ${input.label} existe déjà.` : `Ces dates chevauchent l'année ${clash.label}.`);

    if (!input.id) {
      const year = await db.academicYear.create({
        data: {
          label: input.label,
          startDate: start,
          endDate: end,
          isActive: false,
          periods: { create: periods },
        },
        select: { id: true },
      });
      await audit(user, { action: "create", resource: "calendar", resourceId: year.id, summary: `Création de l'année scolaire ${input.label} (${terms.length} trimestres et 2 semestres)` });
      invalidateCalendar();
      return `Année ${input.label} créée. Activez-la le moment venu.`;
    }

    const year = await db.academicYear.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        label: true,
        endDate: true,
        closedAt: true,
        periods: { orderBy: { order: "asc" }, select: { id: true, order: true, periodicity: true, _count: { select: { gradeSheets: true, reportCards: true } } } },
      },
    });
    if (!year) throw new DomainError("Année scolaire introuvable.");
    if (isYearClosed(year)) throw new DomainError("Cette année est close : elle ne se modifie plus. Accordez une prolongation si des établissements doivent terminer leur saisie.");
    // A period already holding grades or report cards cannot disappear.
    const dropped = year.periods.filter((p) => !periods.some((n) => n.periodicity === p.periodicity && n.order === p.order));
    const used = dropped.find((p) => p._count.gradeSheets || p._count.reportCards);
    if (used) throw new DomainError(`${periodName(used.periodicity, used.order)} contient déjà des notes ou des bulletins : cette période ne peut pas être retirée.`);

    await db.$transaction(async (tx) => {
      await tx.academicYear.update({ where: { id: year.id }, data: { label: input.label, startDate: start, endDate: end } });
      if (dropped.length) await tx.schoolPeriod.deleteMany({ where: { id: { in: dropped.map((p) => p.id) } } });
      for (const p of periods) {
        await tx.schoolPeriod.upsert({
          where: { academicYearId_periodicity_order: { academicYearId: year.id, periodicity: p.periodicity, order: p.order } },
          create: { academicYearId: year.id, ...p },
          update: { name: p.name, startDate: p.startDate, endDate: p.endDate },
        });
      }
    });
    await audit(user, { action: "update", resource: "calendar", resourceId: year.id, summary: `Modification du calendrier ${input.label}`, metadata: { periods: periods.length } });
    invalidateCalendar();
    return `Calendrier ${input.label} enregistré. Tous les établissements le suivent.`;
  },
});

export const activateYear = createAction({
  permission: "calendar:update",
  schema: z.object({ id }),
  handler: async ({ id }, user) => {
    assertMinistry(user);
    const year = await db.academicYear.findUnique({ where: { id }, select: { id: true, label: true, isActive: true, endDate: true, closedAt: true, _count: { select: { periods: true } } } });
    if (!year) throw new DomainError("Année scolaire introuvable.");
    if (year.isActive) return `L'année ${year.label} est déjà l'année en cours.`;
    if (isYearClosed(year)) throw new DomainError("Une année close ne peut pas devenir l'année en cours.");
    if (!year._count.periods) throw new DomainError("Définissez d'abord les périodes de cette année.");
    await db.$transaction([db.academicYear.updateMany({ where: { isActive: true }, data: { isActive: false } }), db.academicYear.update({ where: { id: year.id }, data: { isActive: true } })]);
    await audit(user, { action: "update", resource: "calendar", resourceId: year.id, summary: `Activation de l'année scolaire ${year.label}` });
    invalidateCalendar();
    return `${year.label} est désormais l'année en cours dans tous les établissements.`;
  },
});

export const setYearClosed = createAction({
  permission: "calendar:lock",
  schema: z.object({ id, close: z.enum(["true", "false"]).transform((v) => v === "true") }),
  handler: async ({ id, close }, user) => {
    assertMinistry(user);
    const year = await db.academicYear.findUnique({ where: { id }, select: { id: true, label: true, endDate: true, closedAt: true } });
    if (!year) throw new DomainError("Année scolaire introuvable.");
    const now = new Date();
    if (close) {
      if (year.closedAt && year.closedAt <= now) return `L'année ${year.label} est déjà close.`;
      await db.academicYear.update({ where: { id: year.id }, data: { closedAt: now } });
    } else {
      if (!year.closedAt) return `L'année ${year.label} n'a pas été close par le ministère.`;
      if (isYearClosed({ endDate: year.endDate, closedAt: null }, now))
        throw new DomainError(`La date de fin de l'année ${year.label} est passée : accordez plutôt une prolongation aux établissements concernés.`);
      await db.academicYear.update({ where: { id: year.id }, data: { closedAt: null } });
    }
    await audit(user, { action: close ? "lock" : "unlock", resource: "calendar", resourceId: year.id, summary: `${close ? "Clôture" : "Réouverture"} de l'année scolaire ${year.label}` });
    invalidateCalendar();
    return close ? `L'année ${year.label} est close : elle reste consultable, plus aucune modification n'est possible sans prolongation.` : `L'année ${year.label} est rouverte.`;
  },
});

const extensionSchema = z
  .object({
    academicYearId: id,
    target: z.enum(["all", "schools"], "Choisissez les établissements concernés."),
    schoolIds: z
      .union([z.array(id), id])
      .optional()
      .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v])),
    until: isoDate,
    reason: z.string().trim().min(5, "Précisez le motif (5 caractères minimum).").max(500, "500 caractères au maximum."),
  })
  .superRefine((v, ctx) => {
    if (v.target === "schools" && v.schoolIds.length === 0) ctx.addIssue({ code: "custom", path: ["schoolIds"], message: "Choisissez au moins un établissement." });
    if (v.schoolIds.length > 500) ctx.addIssue({ code: "custom", path: ["schoolIds"], message: "500 établissements au maximum par prolongation." });
  });

export const createExtension = createAction({
  permission: "calendar:approve",
  schema: extensionSchema,
  handler: async (input, user) => {
    assertMinistry(user);
    const r = await grantExtension(user, { academicYearId: input.academicYearId, schoolIds: input.target === "all" ? null : input.schoolIds, until: input.until, reason: input.reason });
    return `Année ${r.label} prolongée jusqu'au ${formatDate(r.until)} pour ${r.who}.`;
  },
});

export const endExtension = createAction({
  permission: "calendar:approve",
  schema: z.object({ id }),
  handler: async ({ id }, user) => {
    assertMinistry(user);
    const ext = await db.yearExtension.findUnique({ where: { id }, select: { id: true, status: true, schoolId: true, academicYear: { select: { label: true } }, school: { select: { name: true } } } });
    if (!ext) throw new DomainError("Prolongation introuvable.");
    if (ext.status === "ENDED") return "Cette prolongation est déjà terminée.";
    await db.yearExtension.update({ where: { id: ext.id }, data: { status: "ENDED" } });
    await audit(user, {
      action: "update",
      resource: "calendar",
      resourceId: ext.id,
      summary: `Fin de la prolongation ${ext.academicYear.label} pour ${ext.school?.name ?? "tous les établissements"}`,
      schoolId: ext.schoolId,
    });
    invalidateCalendar();
    return "Prolongation terminée : l'année est de nouveau en lecture seule.";
  },
});
