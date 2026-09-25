"use server";

import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { invalidate, tags } from "@/lib/cache";
import { db } from "@/lib/db";
import { PAYMENT_METHOD_LABELS } from "@/lib/domain/payments";
import { DomainError } from "@/lib/errors";
import { formatFcfa } from "@/lib/utils";

import { invoiceWhere, paymentWhere, startOfToday } from "@/features/fees/access";

import { lockInvoice, recordPaymentInTx, redistribute } from "./record";
import { paymentIdSchema, paymentSchema } from "./schema";

export const recordPayment = createAction({
  permission: "payment:create",
  schema: paymentSchema,
  handler: async (input, user) => {
    const found = await db.invoice.findFirst({ where: { AND: [{ id: input.invoiceId }, invoiceWhere(user)] }, select: { id: true } });
    if (!found) throw new DomainError("Facture introuvable.");
    const today = startOfToday();
    const { payment, invoice } = await db.$transaction(
      (tx) =>
        recordPaymentInTx(
          tx,
          {
            invoiceId: found.id,
            amount: input.amount,
            method: input.method,
            transactionId: input.transactionId ?? null,
            paidAt: new Date(`${input.paidAt}T12:00:00Z`),
            recordedById: user.id,
          },
          today,
        ),
      { timeout: 20_000, maxWait: 10_000 },
    );

    await audit(user, {
      action: "create",
      resource: "payment",
      resourceId: payment.id,
      summary: `Paiement ${payment.reference} de ${formatFcfa(payment.amount)} (${PAYMENT_METHOD_LABELS[payment.method]}) sur la facture ${invoice.number}`,
      metadata: { invoiceId: invoice.id, amount: payment.amount, method: payment.method },
      schoolId: invoice.schoolId,
    });
    invalidate(tags.stats);
    const rest = invoice.totalAmount - invoice.paidAmount;
    return {
      message: `Paiement ${payment.reference} enregistré. ${rest > 0 ? `Reste à payer : ${formatFcfa(rest)}.` : "La facture est soldée."}`,
      data: { paymentId: payment.id, reference: payment.reference },
    };
  },
});

// Cancelling a payment removes it and recomputes the invoice from the
// remaining payments: the reversal of the waterfall. The audit log keeps the
// cancelled payment's reference and amount.
export const cancelPayment = createAction({
  permission: "payment:delete",
  schema: paymentIdSchema,
  handler: async (input, user) => {
    const payment = await db.payment.findFirst({
      where: { AND: [{ id: input.id }, paymentWhere(user)] },
      include: { invoice: { select: { id: true, number: true, status: true, schoolId: true } } },
    });
    if (!payment) throw new DomainError("Paiement introuvable.");
    if (payment.invoice.status === "CANCELLED") throw new DomainError("La facture est annulée : ses paiements ne peuvent plus être modifiés.");
    const today = startOfToday();

    const invoice = await db.$transaction(async (tx) => {
      await lockInvoice(tx, payment.invoice.id);
      const deleted = await tx.payment.deleteMany({ where: { id: payment.id } });
      if (!deleted.count) throw new DomainError("Ce paiement a déjà été annulé.");
      return redistribute(tx, payment.invoice.id, today);
    });

    await audit(user, {
      action: "delete",
      resource: "payment",
      resourceId: payment.id,
      summary: `Paiement ${payment.reference} de ${formatFcfa(payment.amount)} annulé sur la facture ${invoice.number}`,
      metadata: {
        invoiceId: invoice.id,
        reference: payment.reference,
        amount: payment.amount,
        method: payment.method,
        transactionId: payment.transactionId,
        paidAt: payment.paidAt.toISOString(),
      },
      schoolId: invoice.schoolId,
    });
    invalidate(tags.stats);
    return `Paiement ${payment.reference} annulé. Reste à payer : ${formatFcfa(invoice.totalAmount - invoice.paidAmount)}.`;
  },
});
