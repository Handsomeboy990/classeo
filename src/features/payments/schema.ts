import { z } from "zod";

import { PAYMENT_METHODS } from "@/lib/domain/payments";

export const paymentSchema = z
  .object({
    invoiceId: z.string().trim().min(1).max(40),
    amount: z.coerce
      .number({ error: "Saisissez un montant." })
      .int("Le montant est un nombre entier de francs.")
      .min(1, "Le montant doit être supérieur à zéro."),
    method: z.enum(PAYMENT_METHODS, { error: "Choisissez un mode de paiement." }),
    transactionId: z
      .string()
      .trim()
      .max(80, "Référence trop longue.")
      .optional()
      .transform((v) => (v ? v : undefined)),
    paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choisissez la date du paiement."),
  })
  .superRefine((v, ctx) => {
    if (v.method !== "CASH" && !v.transactionId)
      ctx.addIssue({
        code: "custom",
        path: ["transactionId"],
        message: v.method === "CHEQUE" ? "Saisissez le numéro du chèque." : "Saisissez la référence de la transaction.",
      });
    const day = new Date(`${v.paidAt}T00:00:00Z`);
    const today = new Date().toISOString().slice(0, 10);
    if (Number.isNaN(day.getTime())) ctx.addIssue({ code: "custom", path: ["paidAt"], message: "Date invalide." });
    else if (v.paidAt > today) ctx.addIssue({ code: "custom", path: ["paidAt"], message: "La date ne peut pas être dans le futur." });
    else if (v.paidAt < "2020-01-01") ctx.addIssue({ code: "custom", path: ["paidAt"], message: "Date trop ancienne." });
  });

export const paymentIdSchema = z.object({ id: z.string().trim().min(1).max(40) });
