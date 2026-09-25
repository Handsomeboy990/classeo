"use server";

import { Prisma } from "@/generated/prisma/client";
import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { ForbiddenError } from "@/lib/auth/authorize";
import type { CurrentUser } from "@/lib/auth/session";
import { invalidate, tags } from "@/lib/cache";
import { db } from "@/lib/db";
import { PAYMENT_METHOD_LABELS } from "@/lib/domain/payments";
import { DomainError } from "@/lib/errors";
import { isEnabled } from "@/lib/features";
import { saveUpload } from "@/lib/files";
import { assertWritable } from "@/lib/guards";
import { appUrl } from "@/lib/mail/config";
import { notify } from "@/lib/notify";
import { onlineProvider } from "@/lib/payments/providers";
import { ProviderError } from "@/lib/payments/providers/types";
import { formatFcfa } from "@/lib/utils";

import { invoiceWhere, requireSchoolId, startOfToday } from "@/features/fees/access";
import { recordPaymentInTx } from "@/features/payments/record";

import { paymentStaffIds } from "./queries";
import { amountFor, normalizeTransactionRef } from "./rules";
import { accountSchema, accountToggleSchema, declarationSchema, decideSchema, rejectSchema, startOnlineSchema } from "./schema";

type User = NonNullable<CurrentUser>;

// Parents pay for their own children: a guardian account, and an invoice
// reached through invoiceWhere(), which follows the guardian link.
function requireGuardian(user: User) {
  if (user.scope.level !== "SELF" || !user.guardianId) throw new ForbiddenError("Le paiement en ligne est réservé aux parents et tuteurs.");
}

async function invoiceToPay(user: User, invoiceId: string) {
  const invoice = await db.invoice.findFirst({
    where: { AND: [{ id: invoiceId }, invoiceWhere(user)] },
    select: {
      id: true,
      number: true,
      status: true,
      totalAmount: true,
      paidAmount: true,
      schoolId: true,
      installments: { select: { id: true, order: true, label: true, amount: true, paidAmount: true, dueDate: true } },
      enrollment: { select: { academicYearId: true, student: { select: { firstName: true, lastName: true } } } },
      school: { select: { name: true } },
    },
  });
  if (!invoice) throw new DomainError("Facture introuvable.");
  return invoice;
}

// Starts an online payment: the amount is computed here from the invoice
// and the installments chosen, never read from the browser. The payer is
// sent to the provider's page; the webhook, or the return page, confirms.
export const startOnlinePayment = createAction({
  permission: "fee:view",
  schema: startOnlineSchema,
  handler: async (input, user) => {
    requireGuardian(user);
    const provider = await onlineProvider();
    if (!provider) throw new DomainError("Le paiement en ligne n'est pas disponible pour le moment. Déclarez un paiement déjà fait ou réglez à l'établissement.");
    const invoice = await invoiceToPay(user, input.invoiceId);
    await assertWritable({ schoolId: invoice.schoolId, academicYearId: invoice.enrollment.academicYearId });
    const { amount, installmentIds } = amountFor(invoice, input.mode === "all" ? { mode: "all" } : { mode: "installments", ids: input.installments });

    const op = await db.onlinePayment.create({
      data: { provider: provider.id, invoiceId: invoice.id, installmentIds, amount, currency: "XOF", payerId: user.id, payerPhone: input.phone ?? null },
    });
    const s = invoice.enrollment.student;
    try {
      const checkout = await provider.createCheckout({
        onlinePaymentId: op.id,
        amount,
        currency: "XOF",
        description: `Frais scolaires ${s.firstName} ${s.lastName}, facture ${invoice.number}, ${invoice.school.name}`,
        returnUrl: `${appUrl(process.env)}/espace/payer/retour/${op.id}`,
        customer: { firstName: user.firstName, lastName: user.lastName, email: user.email, phone: input.phone ?? null },
      });
      await db.onlinePayment.update({ where: { id: op.id }, data: { providerRef: checkout.providerRef, checkoutUrl: checkout.checkoutUrl, status: "PENDING" } });
      await audit(user, {
        action: "create",
        resource: "online_payment",
        resourceId: op.id,
        summary: `Paiement en ligne de ${formatFcfa(amount)} lancé (${provider.id}) pour la facture ${invoice.number}`,
        metadata: { invoiceId: invoice.id, amount, installmentIds, providerRef: checkout.providerRef },
        schoolId: invoice.schoolId,
      });
      return { message: "Redirection vers la page de paiement sécurisée…", data: { url: checkout.checkoutUrl } };
    } catch (error) {
      await db.onlinePayment.update({ where: { id: op.id }, data: { status: "CANCELED", lastEvent: { error: error instanceof Error ? error.message : "unknown" } } });
      if (error instanceof ProviderError) throw new DomainError(`${error.message} Aucun montant n'a été prélevé.`);
      throw error;
    }
  },
});

// A payment the parent made outside the platform (Mobile Money transfer to
// the school's number, bank transfer), declared with its reference. The same
// reference cannot be declared twice on an invoice.
export const declarePayment = createAction({
  permission: "fee:view",
  schema: declarationSchema,
  handler: async (input, user) => {
    requireGuardian(user);
    if (!(await isEnabled("payments.declaration"))) throw new DomainError("La déclaration de paiement n'est pas ouverte pour le moment.");
    const invoice = await invoiceToPay(user, input.invoiceId);
    await assertWritable({ schoolId: invoice.schoolId, academicYearId: invoice.enrollment.academicYearId });
    if (invoice.status === "CANCELLED") throw new DomainError("Cette facture est annulée.");
    const pending = await db.paymentDeclaration.aggregate({ where: { invoiceId: invoice.id, status: "PENDING" }, _sum: { amount: true } });
    const rest = invoice.totalAmount - invoice.paidAmount - (pending._sum.amount ?? 0);
    if (rest <= 0) throw new DomainError("Le reste à payer est déjà couvert par les paiements reçus et ceux en cours de vérification.");
    if (input.amount > rest) throw new DomainError(`Le montant déclaré (${formatFcfa(input.amount)}) dépasse le reste à payer hors paiements en cours de vérification (${formatFcfa(rest)}).`);
    if (input.accountId) {
      const account = await db.schoolPaymentAccount.count({ where: { id: input.accountId, schoolId: invoice.schoolId, isActive: true } });
      if (!account) throw new DomainError("Ce compte de l'établissement n'est plus actif.");
    }
    const ref = normalizeTransactionRef(input.transactionRef);
    const existing = await db.paymentDeclaration.findUnique({ where: { invoiceId_transactionRef: { invoiceId: invoice.id, transactionRef: ref } }, select: { status: true } });
    if (existing) throw new DomainError(`Cette référence a déjà été déclarée pour cette facture${existing.status === "PENDING" ? " : elle est en cours de vérification" : ""}.`);

    const proofFileId = input.proof ? await saveUpload(user, "payment_proof", input.proof) : null;
    let declaration;
    try {
      declaration = await db.paymentDeclaration.create({
        data: { invoiceId: invoice.id, accountId: input.accountId ?? null, amount: input.amount, method: input.method, payerPhone: input.payerPhone ?? null, transactionRef: ref, proofFileId, declaredById: user.id },
      });
    } catch (error) {
      // Two submissions at the same instant: the unique index decides.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new DomainError("Cette référence a déjà été déclarée pour cette facture.");
      throw error;
    }
    const s = invoice.enrollment.student;
    await audit(user, {
      action: "create",
      resource: "payment_declaration",
      resourceId: declaration.id,
      summary: `Paiement de ${formatFcfa(input.amount)} déclaré (${PAYMENT_METHOD_LABELS[input.method]}, réf. ${ref}) pour la facture ${invoice.number}`,
      metadata: { invoiceId: invoice.id, amount: input.amount, method: input.method },
      schoolId: invoice.schoolId,
    });
    await notify(await paymentStaffIds(invoice.schoolId), {
      kind: "payment_declared",
      title: "Paiement déclaré par un parent",
      body: `${formatFcfa(input.amount)} pour ${s.firstName} ${s.lastName}, facture ${invoice.number}, réf. ${ref}. À vérifier puis confirmer.`,
      link: "/espace/frais/declarations",
    });
    return `Paiement déclaré. Le service de la comptabilité le vérifie et vous prévient dès qu'il est confirmé.`;
  },
});

async function declarationInScope(user: User, id: string) {
  const d = await db.paymentDeclaration.findFirst({
    where: { AND: [{ id }, { invoice: invoiceWhere(user) }] },
    select: {
      id: true,
      amount: true,
      method: true,
      transactionRef: true,
      status: true,
      declaredById: true,
      createdAt: true,
      invoice: { select: { id: true, number: true, schoolId: true, enrollment: { select: { academicYearId: true, student: { select: { firstName: true, lastName: true } } } } } },
    },
  });
  if (!d) throw new DomainError("Déclaration introuvable.");
  if (user.scope.level === "SELF") throw new ForbiddenError();
  return d;
}

// The accountant checked the money arrived: the declaration becomes a
// Payment, through the same recording as the cash desk (waterfall,
// receipt). Only a pending declaration can be confirmed, once.
export const confirmDeclaration = createAction({
  permission: "payment:create",
  schema: decideSchema,
  handler: async (input, user) => {
    const d = await declarationInScope(user, input.id);
    requireSchoolId(user);
    await assertWritable({ schoolId: d.invoice.schoolId, academicYearId: d.invoice.enrollment.academicYearId });
    const today = startOfToday();
    const { payment, invoice } = await db.$transaction(
      async (tx) => {
        const claimed = await tx.paymentDeclaration.updateMany({ where: { id: d.id, status: "PENDING" }, data: { status: "CONFIRMED", decidedById: user.id, decidedAt: new Date() } });
        if (!claimed.count) throw new DomainError("Cette déclaration a déjà été traitée.");
        const recorded = await recordPaymentInTx(
          tx,
          { invoiceId: d.invoice.id, amount: d.amount, method: d.method, transactionId: d.transactionRef, paidAt: d.createdAt, recordedById: user.id },
          today,
        );
        await tx.paymentDeclaration.update({ where: { id: d.id }, data: { paymentId: recorded.payment.id } });
        return recorded;
      },
      { timeout: 20_000, maxWait: 10_000 },
    );
    const s = d.invoice.enrollment.student;
    await audit(user, {
      action: "approve",
      resource: "payment_declaration",
      resourceId: d.id,
      summary: `Déclaration de ${formatFcfa(d.amount)} (réf. ${d.transactionRef}) confirmée : paiement ${payment.reference} sur la facture ${invoice.number}`,
      metadata: { paymentId: payment.id, invoiceId: invoice.id },
      schoolId: invoice.schoolId,
    });
    invalidate(tags.stats);
    const rest = invoice.totalAmount - invoice.paidAmount;
    await notify([d.declaredById], {
      kind: "payment_confirmed",
      title: "Paiement confirmé",
      body: `Votre paiement de ${formatFcfa(d.amount)} pour ${s.firstName} (réf. ${d.transactionRef}) est confirmé. Reçu ${payment.reference}. ${rest > 0 ? `Reste à payer : ${formatFcfa(rest)}.` : "La facture est soldée."}`,
      link: `/espace/payer/${invoice.id}`,
    });
    return `Paiement ${payment.reference} enregistré, le parent est prévenu.`;
  },
});

export const rejectDeclaration = createAction({
  permission: "payment:create",
  schema: rejectSchema,
  handler: async (input, user) => {
    const d = await declarationInScope(user, input.id);
    await assertWritable({ schoolId: d.invoice.schoolId, academicYearId: d.invoice.enrollment.academicYearId });
    const claimed = await db.paymentDeclaration.updateMany({ where: { id: d.id, status: "PENDING" }, data: { status: "REJECTED", decidedById: user.id, decidedAt: new Date(), note: input.note } });
    if (!claimed.count) throw new DomainError("Cette déclaration a déjà été traitée.");
    const s = d.invoice.enrollment.student;
    await audit(user, {
      action: "reject",
      resource: "payment_declaration",
      resourceId: d.id,
      summary: `Déclaration de ${formatFcfa(d.amount)} (réf. ${d.transactionRef}) refusée sur la facture ${d.invoice.number} : ${input.note}`,
      schoolId: d.invoice.schoolId,
    });
    await notify([d.declaredById], {
      kind: "payment_rejected",
      title: "Paiement non confirmé",
      body: `Le paiement déclaré de ${formatFcfa(d.amount)} pour ${s.firstName} (réf. ${d.transactionRef}) n'a pas été retrouvé. Motif : ${input.note}`,
      link: `/espace/payer/${d.invoice.id}`,
    });
    return "Déclaration refusée, le parent est prévenu avec le motif.";
  },
});

// The school's accounts shown to parents (number, holder, instructions).
export const createPaymentAccount = createAction({
  permission: "fee:update",
  schema: accountSchema,
  handler: async (input, user) => {
    const schoolId = requireSchoolId(user);
    await assertWritable({ schoolId });
    const a = await db.schoolPaymentAccount.create({ data: { ...input, schoolId } });
    await audit(user, { action: "create", resource: "payment_account", resourceId: a.id, summary: `Compte de paiement ajouté : ${a.provider} ${a.accountNumber} (${a.accountName})`, schoolId });
    return `Compte ${a.provider} ajouté. Les parents le voient sur la page de paiement.`;
  },
});

export const togglePaymentAccount = createAction({
  permission: "fee:update",
  schema: accountToggleSchema,
  handler: async (input, user) => {
    const schoolId = requireSchoolId(user);
    await assertWritable({ schoolId });
    const a = await db.schoolPaymentAccount.findFirst({ where: { id: input.id, schoolId } });
    if (!a) throw new DomainError("Compte introuvable.");
    const active = input.active === "true";
    await db.schoolPaymentAccount.update({ where: { id: a.id }, data: { isActive: active } });
    await audit(user, { action: "update", resource: "payment_account", resourceId: a.id, summary: `Compte de paiement ${a.provider} ${a.accountNumber} ${active ? "réactivé" : "désactivé"}`, schoolId });
    return active ? `Compte ${a.provider} réactivé.` : `Compte ${a.provider} désactivé : il n'est plus proposé aux parents.`;
  },
});
