import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { assertPaymentAllowed, distributePaid, formatReference, invoiceStatus, type PaymentMethodCode } from "@/lib/domain/payments";

// The one way a payment reaches an invoice, whoever records it (the
// cashier, the accountant confirming a parent's declaration, the online
// payment webhook): inside a transaction, invoice row locked, remaining due
// checked, reference drawn in sequence, installments recomputed with the
// waterfall rule.

const PAYMENT_LOCK = "classeo:payment-reference";

// Recomputes the installments and the invoice from the payments that remain,
// with the waterfall rule. Used after recording and after cancelling.
export async function redistribute(tx: Prisma.TransactionClient, invoiceId: string, today: Date) {
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
export async function lockInvoice(tx: Prisma.TransactionClient, invoiceId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE`;
}

export type PaymentInput = {
  invoiceId: string;
  amount: number;
  method: PaymentMethodCode;
  transactionId: string | null;
  paidAt: Date;
  recordedById: string;
};

// Call inside db.$transaction. Throws a DomainError when the invoice is
// cancelled, settled, or the amount exceeds what remains due.
export async function recordPaymentInTx(tx: Prisma.TransactionClient, input: PaymentInput, today: Date) {
  await lockInvoice(tx, input.invoiceId);
  const current = await tx.invoice.findUniqueOrThrow({ where: { id: input.invoiceId }, include: { installments: true } });
  const status = invoiceStatus({ ...current, cancelled: current.status === "CANCELLED", today });
  assertPaymentAllowed({ status, totalAmount: current.totalAmount, paidAmount: current.paidAmount }, input.amount);

  const year = today.getUTCFullYear();
  const prefix = `PAY-${year}-`;
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
      transactionId: input.transactionId,
      paidAt: input.paidAt,
      recordedById: input.recordedById,
    },
  });
  const invoice = await redistribute(tx, current.id, today);
  return { payment, invoice };
}
