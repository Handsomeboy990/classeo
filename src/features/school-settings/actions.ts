"use server";

import { z } from "zod";

import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { invalidate, tags } from "@/lib/cache";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { saveUpload } from "@/lib/files";
import { assertSchoolWritable } from "@/lib/guards";

import { MAX_PAYMENT_ACCOUNTS, MOBILE_MONEY_PROVIDERS, normalizeBankAccount, normalizeMobileNumber, normalizeWebsite } from "./rules";

type User = NonNullable<CurrentUser>;

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères au maximum.`)
    .optional()
    .transform((v) => v || null);

// The school comes from the session: a head edits their own school only.
async function ownSchool(user: User) {
  if (user.scope.level !== "SCHOOL" || !user.scope.schoolId) throw new DomainError("Ces paramètres se règlent depuis le compte de l'établissement.");
  const school = await db.school.findFirst({ where: { AND: [{ id: user.scope.schoolId }, schoolWhere(user)] }, select: { id: true, name: true, logoFileId: true } });
  if (!school) throw new DomainError("Établissement introuvable.");
  await assertSchoolWritable(school.id);
  return school;
}

function invalidateSchool(id: string) {
  invalidate(tags.schools, tags.school(id));
}

export const updateSchoolProfile = createAction({
  permission: "school:update",
  schema: z.object({
    name: z.string().trim().min(3, "Le nom compte au moins 3 caractères.").max(150, "150 caractères au maximum."),
    motto: optional(120),
    address: optional(200),
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
    postalBox: optional(60),
    website: z
      .string()
      .trim()
      .max(200, "200 caractères au maximum.")
      .optional()
      .transform((v) => (v ? normalizeWebsite(v) : null) ?? (v ? "invalid" : null))
      .refine((v) => v !== "invalid", "Adresse web invalide, par exemple www.mon-ecole.bj."),
    logo: z.instanceof(File).optional(),
    removeLogo: z
      .string()
      .optional()
      .transform((v) => v === "on" || v === "true"),
  }),
  handler: async ({ logo, removeLogo, ...input }, user) => {
    const school = await ownSchool(user);
    let logoFileId = school.logoFileId;
    if (logo && logo.size > 0) logoFileId = await saveUpload(user, "school_logo", logo);
    else if (removeLogo) logoFileId = null;
    await db.school.update({ where: { id: school.id }, data: { ...input, logoFileId } });
    // The previous logo is no longer referenced: its bytes go.
    if (school.logoFileId && school.logoFileId !== logoFileId) await db.fileBlob.deleteMany({ where: { id: school.logoFileId, purpose: "school_logo" } });
    await audit(user, {
      action: "update",
      resource: "school",
      resourceId: school.id,
      schoolId: school.id,
      summary: `Paramètres de l'établissement ${input.name}${logoFileId !== school.logoFileId ? (logoFileId ? ", nouveau logo" : ", logo retiré") : ""}`,
    });
    invalidateSchool(school.id);
    return "Paramètres de l'établissement enregistrés.";
  },
});

const accountSchema = z
  .object({
    id: z
      .string()
      .trim()
      .max(64)
      .optional()
      .transform((v) => v || null),
    channel: z.enum(["MOBILE_MONEY", "BANK"], "Choisissez Mobile Money ou banque."),
    provider: z.string().trim().min(2, "Précisez le réseau ou la banque.").max(80, "80 caractères au maximum."),
    accountName: z.string().trim().min(3, "Le titulaire compte au moins 3 caractères.").max(120, "120 caractères au maximum."),
    accountNumber: z.string().trim().min(1, "Champ obligatoire.").max(60),
    instructions: optional(300),
    isActive: z
      .string()
      .optional()
      .transform((v) => v === "on" || v === "true"),
  })
  .transform((v, ctx) => {
    if (v.channel === "MOBILE_MONEY" && !(MOBILE_MONEY_PROVIDERS as readonly string[]).includes(v.provider)) {
      ctx.addIssue({ code: "custom", path: ["provider"], message: "Choisissez MTN MoMo, Moov Money ou Celtiis Cash." });
      return z.NEVER;
    }
    const number = v.channel === "MOBILE_MONEY" ? normalizeMobileNumber(v.accountNumber) : normalizeBankAccount(v.accountNumber);
    if (!number) {
      ctx.addIssue({
        code: "custom",
        path: ["accountNumber"],
        message: v.channel === "MOBILE_MONEY" ? "Numéro Mobile Money invalide : 10 chiffres commençant par 01." : "Numéro de compte invalide : IBAN (BJ puis 26 caractères) ou RIB.",
      });
      return z.NEVER;
    }
    return { ...v, accountNumber: number };
  });

export const savePaymentAccount = createAction({
  permission: "school:update",
  schema: accountSchema,
  handler: async ({ id, ...input }, user) => {
    const school = await ownSchool(user);
    if (id) {
      const { count } = await db.schoolPaymentAccount.updateMany({ where: { id, schoolId: school.id }, data: input });
      if (!count) throw new DomainError("Compte introuvable pour votre établissement.");
    } else {
      const existing = await db.schoolPaymentAccount.count({ where: { schoolId: school.id } });
      if (existing >= MAX_PAYMENT_ACCOUNTS) throw new DomainError(`${MAX_PAYMENT_ACCOUNTS} comptes au maximum par établissement.`);
      await db.schoolPaymentAccount.create({ data: { ...input, schoolId: school.id } });
    }
    await audit(user, {
      action: id ? "update" : "create",
      resource: "school",
      resourceId: school.id,
      schoolId: school.id,
      summary: `Compte de paiement ${input.provider} (${input.accountNumber.slice(-4)}) ${id ? "modifié" : "ajouté"}${input.isActive ? "" : ", inactif"}`,
    });
    invalidateSchool(school.id);
    return id ? "Compte de paiement enregistré." : `Compte ${input.provider} ajouté. Les parents pourront y payer.`;
  },
});

export const deletePaymentAccount = createAction({
  permission: "school:update",
  schema: z.object({ id: z.string().trim().min(1).max(64) }),
  handler: async ({ id }, user) => {
    const school = await ownSchool(user);
    const account = await db.schoolPaymentAccount.findFirst({ where: { id, schoolId: school.id }, select: { id: true, provider: true } });
    if (!account) throw new DomainError("Compte introuvable pour votre établissement.");
    // A declared payment keeps the account id as a reference: such an account
    // is deactivated rather than deleted.
    const used = await db.paymentDeclaration.count({ where: { accountId: account.id } });
    if (used) {
      await db.schoolPaymentAccount.update({ where: { id: account.id }, data: { isActive: false } });
      await audit(user, { action: "update", resource: "school", resourceId: school.id, schoolId: school.id, summary: `Compte de paiement ${account.provider} désactivé (déjà utilisé par des parents)` });
      invalidateSchool(school.id);
      return "Ce compte a déjà reçu des paiements déclarés : il est désactivé et reste dans l'historique.";
    }
    await db.schoolPaymentAccount.delete({ where: { id: account.id } });
    await audit(user, { action: "delete", resource: "school", resourceId: school.id, schoolId: school.id, summary: `Compte de paiement ${account.provider} supprimé` });
    invalidateSchool(school.id);
    return "Compte de paiement supprimé.";
  },
});

// Compositions are a school practice, outside the national formula (order
// n° 029 of 2024): the head decides whether the grade sheets offer them.
// Sheets already created keep their formula.
export const updateEvaluationOptions = createAction({
  permission: "school:update",
  schema: z.object({
    allowsComposition: z
      .string()
      .optional()
      .transform((v) => v === "on" || v === "true"),
  }),
  handler: async ({ allowsComposition }, user) => {
    const school = await ownSchool(user);
    await db.school.update({ where: { id: school.id }, data: { allowsComposition } });
    await audit(user, {
      action: "update",
      resource: "school",
      resourceId: school.id,
      schoolId: school.id,
      summary: allowsComposition ? `Compositions activées pour ${school.name}` : `Compositions désactivées pour ${school.name}`,
    });
    invalidateSchool(school.id);
    return allowsComposition
      ? "Les nouvelles fiches de notes pourront compter des compositions."
      : "Les nouvelles fiches de notes suivront la formule officielle, sans composition.";
  },
});
