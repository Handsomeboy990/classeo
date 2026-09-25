"use server";

import type { Prisma } from "@/generated/prisma/client";
import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { invalidate, tags } from "@/lib/cache";
import { db } from "@/lib/db";
import { assertInvoiceWritable } from "@/lib/guards";
import { assertPaymentAllowed, distributePaid, formatReference, invoiceStatus, PAYMENT_METHOD_LABELS } from "@/lib/domain/payments";
import { DomainError } from "@/lib/errors";
import { formatFcfa } from "@/lib/utils";

import { invoiceWhere, paymentWhere, startOfToday } from "@/features/fees/access";

import { paymentIdSchema, paymentSchema } from "./schema";

const PAYMENT_LOCK = "classeo:payment-reference";

// Recomputes the installments and the invoice from the payments that remain,
// with the waterfall rule. Used after recording and after cancelling.
async function redistribute(tx: Prisma.TransactionClient, invoiceId: string, today: Date) {
  const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { installments: true } });
  const sum = await tx.payment.aggregate({ where: { invoiceId }, _sum: { amount: true } });
  const paid = sum._sum.amount ?? 0;
  const allocation = distributePaid(invoice.installments, paid, today);
  for (const a of allocation) await tx.invoiceInstallment.update({ where: { id: a.id }, data: { paidAmount: a.paidAmount, status: a.status } });
  const byId = new Map(allocation.map((a) => [a.id, a]));
  const status = invoiceStatus({
    totalAmount: invoice.totalAmount,
    paidAmount: paid,
    dueDate: invoice.dueDate,
    installments: invoice.installments.map((i) => ({ amount: i.amount, dueDate: i.dueDate, paidAmount: byId.get(i.id)!.paidAmount })),
    cancelled: invoice.status === "CANCELLED",
    today,
  });
  return tx.invoice.update({ where: { id: invoiceId }, data: { paidAmount: paid, status } });
}

// Row lock on the invoice: two cashiers recording at the same moment cannot
// both pass the remaining due check.
async function lockInvoice(tx: Prisma.TransactionClient, invoiceId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE`;
}

export const recordPayment = createAction({
  permission: "payment:create",
  schema: paymentSchema,
  handler: async (input, user) => {
    const found = await db.invoice.findFirst({ where: { AND: [{ id: input.invoiceId }, invoiceWhere(user)] }, select: { id: true } });
    if (!found) throw new DomainError("Facture introuvable.");
    await assertInvoiceWritable(found.id);
    const today = startOfToday();
    const year = today.getUTCFullYear();
    const prefix = `PAY-${year}-`;

    const { payment, invoice } = await db.$transaction(
      async (tx) => {
        await lockInvoice(tx, found.id);
        const current = await tx.invoice.findUniqueOrThrow({ where: { id: found.id }, include: { installments: true } });
        const status = invoiceStatus({ ...current, cancelled: current.status === "CANCELLED", today });
        assertPaymentAllowed({ status, totalAmount: current.totalAmount, paidAmount: current.paidAmount }, input.amount);

        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${PAYMENT_LOCK}))`;
        const [{ max }] = await tx.$queryRaw<{ max: number }[]>`
          SELECT COALESCE(MAX(CAST(split_part("reference", '-', 3) AS INTEGER)), 0)::int AS max
          FROM "Payment" WHERE "reference" LIKE ${prefix + "%"}`;

        const payment = await tx.payment.create({
          data: {
            reference: formatReference("PAY", year, max + 1, 5),
            invoiceId: current.id,
            amount: input.amount,
            method: input.method,
            transactionId: input.transactionId ?? null,
            paidAt: new Date(`${input.paidAt}T12:00:00Z`),
            recordedById: user.id,
          },
        });
        const invoice = await redistribute(tx, current.id, today);
        return { payment, invoice };
      },
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
    await assertInvoiceWritable(payment.invoice.id);
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
