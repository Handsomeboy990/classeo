import { z } from "zod";

const id = z.string().trim().min(1).max(40);

const optionalId = z
  .string()
  .trim()
  .max(40)
  .optional()
  .transform((v) => (v ? v : undefined));

const amount = z.coerce
  .number({ error: "Saisissez un montant." })
  .int("Le montant est un nombre entier de francs.")
  .min(1, "Le montant doit être supérieur à zéro.")
  .max(100_000_000, "Montant trop élevé.");

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choisissez une date.")
  .refine((s) => !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()), "Date invalide.");

export const feeTypeSchema = z.object({
  name: z.string().trim().min(2, "Donnez un nom au type de frais.").max(120),
  amount,
  levelId: optionalId,
  isActive: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

export const updateFeeTypeSchema = feeTypeSchema.extend({ id });

export const idSchema = z.object({ id });

const list = <T extends z.ZodType>(item: T) => z.preprocess((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]), z.array(item));

export const planSchema = z
  .object({
    feeTypeId: id,
    planId: optionalId,
    name: z.string().trim().min(2, "Donnez un nom à l'échéancier.").max(120),
    label: list(z.string().trim().min(1, "Nommez chaque tranche.").max(80)),
    percent: list(z.coerce.number().int("Pourcentage entier attendu.")),
    dueDate: list(isoDate),
  })
  .refine((v) => v.label.length === v.percent.length && v.label.length === v.dueDate.length, {
    message: "Chaque tranche doit avoir un nom, un pourcentage et une échéance.",
    path: ["installments"],
  });

export const generateSchema = z.object({
  feeTypeId: id,
  dueDate: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(isoDate.optional()),
});
