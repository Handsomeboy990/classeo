import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/lib/audit";
import { invalidate, tags } from "@/lib/cache";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { notify } from "@/lib/notify";
import type { ProviderTransaction } from "@/lib/payments/providers/types";
import { formatFcfa } from "@/lib/utils";

import { startOfToday } from "@/features/fees/access";
import { recordPaymentInTx } from "@/features/payments/record";

import { paymentStaffIds } from "./queries";
import { settlement } from "./rules";

// Applies a provider state to an online payment, whoever brings it (the
// signed webhook, or the return page asking the provider's API). The row is
// locked, so two deliveries of the same event, or a webhook racing the
// return page, record the Payment once.
export async function settleOnlinePayment(onlinePaymentId: string, t: ProviderTransaction, source: "webhook" | "poll") {
  const today = startOfToday();
  const result = await db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "OnlinePayment" WHERE "id" = ${onlinePaymentId} FOR UPDATE`;
      const op = await tx.onlinePayment.findUniqueOrThrow({ where: { id: onlinePaymentId } });
      const d = settlement(op, t);
      let paymentId = op.paymentId;
      let reference: string | null = null;
      let review: string | null = d.mismatch ? `Montant ou devise reçus (${t.amount} ${t.currency}) différents de la demande (${op.amount} ${op.currency}).` : null;
      if (d.record) {
        try {
          const { payment } = await recordPaymentInTx(
            tx,
            { invoiceId: op.invoiceId, amount: op.amount, method: "MOBILE_MONEY", transactionId: `${op.provider.toUpperCase()} ${t.providerRef}`, paidAt: new Date(), recordedById: op.payerId },
            today,
          );
          paymentId = payment.id;
          reference = payment.reference;
        } catch (error) {
          // The invoice was settled or cancelled meanwhile: the money is
          // received, the accountant decides (refund or other invoice).
          if (!(error instanceof DomainError)) throw error;
          review = error.message;
        }
      }
      const lastEvent: Prisma.InputJsonValue = { source, providerStatus: t.status, amount: t.amount, currency: t.currency, at: new Date().toISOString(), ...(review ? { review } : {}) };
      await tx.onlinePayment.update({ where: { id: op.id }, data: { status: d.status, paymentId, lastEvent } });
      const invoice = await tx.invoice.findUniqueOrThrow({
        where: { id: op.invoiceId },
        select: { number: true, schoolId: true, totalAmount: true, paidAmount: true, enrollment: { select: { student: { select: { firstName: true, lastName: true } } } } },
      });
      const hadReview = !!(op.lastEvent && typeof op.lastEvent === "object" && "review" in op.lastEvent);
      return { op, before: op.status, after: d.status, recorded: !!reference, reference, review, hadReview, invoice };
    },
    { timeout: 20_000, maxWait: 10_000 },
  );

  const { op, invoice } = result;
  const who = `${invoice.enrollment.student.firstName} ${invoice.enrollment.student.lastName}`;
  if (result.recorded) {
    await audit(null, {
      action: "create",
      resource: "payment",
      resourceId: op.id,
      summary: `Paiement en ligne ${result.reference} de ${formatFcfa(op.amount)} (${op.provider}) sur la facture ${invoice.number}, confirmé par le prestataire`,
      metadata: { onlinePaymentId: op.id, providerRef: t.providerRef, source },
      schoolId: invoice.schoolId,
    });
    invalidate(tags.stats);
    const rest = invoice.totalAmount - invoice.paidAmount;
    await notify([op.payerId], {
      kind: "payment_received",
      title: "Paiement reçu",
      body: `Votre paiement de ${formatFcfa(op.amount)} pour ${who} est confirmé (reçu ${result.reference}). ${rest > 0 ? `Reste à payer : ${formatFcfa(rest)}.` : "La facture est soldée."}`,
      link: `/espace/payer/${op.invoiceId}`,
    });
    await notify(await paymentStaffIds(invoice.schoolId), {
      kind: "payment_online",
      title: "Paiement en ligne reçu",
      body: `${formatFcfa(op.amount)} pour ${who}, facture ${invoice.number}, reçu ${result.reference}.`,
      link: `/espace/frais/factures/${op.invoiceId}`,
    });
  } else if (result.review && result.before !== result.after && result.after === "APPROVED") {
    await notify(await paymentStaffIds(invoice.schoolId), {
      kind: "payment_review",
      title: "Paiement en ligne à vérifier",
      body: `${formatFcfa(op.amount)} reçu pour ${who} (facture ${invoice.number}) n'a pas pu être enregistré : ${result.review}`,
      link: "/espace/frais/declarations",
    });
  } else if (result.review && !result.hadReview) {
    await notify(await paymentStaffIds(invoice.schoolId), { kind: "payment_review", title: "Paiement en ligne à vérifier", body: `Facture ${invoice.number} : ${result.review}`, link: "/espace/frais/declarations" });
  } else if (result.before !== result.after && (result.after === "DECLINED" || result.after === "CANCELED")) {
    await notify([op.payerId], {
      kind: "payment_failed",
      title: "Paiement non abouti",
      body: `Le paiement de ${formatFcfa(op.amount)} pour ${who} n'a pas abouti. Aucun montant n'a été enregistré ; vous pouvez réessayer.`,
      link: `/espace/payer/${op.invoiceId}`,
    });
  }
  return result;
}
