import { z } from "zod";

import { normalizeBeninPhone, normalizeTransactionRef } from "./rules";

const id = z.string().trim().min(1).max(40);

// A file input left empty still submits an empty File: read as "no file".
const optionalFile = z.preprocess((v) => (v instanceof File && v.size > 0 ? v : undefined), z.instanceof(File).optional());

const phone = z
  .string()
  .trim()
  .max(30)
  .optional()
  .transform((v, ctx) => {
    if (!v) return undefined;
    const n = normalizeBeninPhone(v);
    if (!n) ctx.addIssue({ code: "custom", message: "Numéro à 10 chiffres, par exemple 01 97 00 00 00." });
    return n ?? undefined;
  });

export const startOnlineSchema = z.object({
  invoiceId: id,
  mode: z.enum(["all", "installments"], { error: "Choisissez ce que vous payez." }),
  installments: z.array(id).max(24).optional().default([]),
  phone,
});

export const declarationSchema = z
  .object({
    invoiceId: id,
    accountId: id.optional(),
    amount: z.coerce.number({ error: "Saisissez le montant payé." }).int("Le montant est un nombre entier de francs.").min(1, "Le montant doit être supérieur à zéro."),
    method: z.enum(["MOBILE_MONEY", "BANK_TRANSFER"], { error: "Choisissez le moyen utilisé." }),
    payerPhone: phone,
    transactionRef: z
      .string({ error: "Saisissez la référence de la transaction." })
      .trim()
      .min(4, "Saisissez la référence reçue par SMS ou sur le reçu de la banque.")
      .max(60, "Référence trop longue."),
    proof: optionalFile,
  })
  .superRefine((v, ctx) => {
    if (v.method === "MOBILE_MONEY" && !v.payerPhone) ctx.addIssue({ code: "custom", path: ["payerPhone"], message: "Saisissez le numéro qui a payé." });
    if (normalizeTransactionRef(v.transactionRef).length < 4) ctx.addIssue({ code: "custom", path: ["transactionRef"], message: "Référence incomplète." });
  });

export const decideSchema = z.object({ id });

export const rejectSchema = z.object({
  id,
  note: z.string().trim().min(5, "Expliquez au parent pourquoi, en quelques mots.").max(300, "300 caractères au maximum."),
});

export const accountSchema = z.object({
  channel: z.enum(["MOBILE_MONEY", "BANK"], { error: "Choisissez le type de compte." }),
  provider: z.string().trim().min(2, "Indiquez l'opérateur ou la banque.").max(60),
  accountName: z.string().trim().min(2, "Indiquez le titulaire du compte.").max(120),
  accountNumber: z.string().trim().min(4, "Indiquez le numéro.").max(60),
  instructions: z
    .string()
    .trim()
    .max(400, "400 caractères au maximum.")
    .optional()
    .transform((v) => v || null),
});

export const accountToggleSchema = z.object({ id, active: z.enum(["true", "false"]) });
