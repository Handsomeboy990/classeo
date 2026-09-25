// Rules of parent payments, pure and tested: what an online payment covers
// (always computed on the server from the invoice, never taken from the
// browser), how its status moves, and how a declared reference is compared.

import type { OnlineStatus } from "@/lib/payments/providers/types";
import { DomainError } from "@/lib/errors";
import { remainingDue } from "@/lib/domain/payments";

export type PayableInstallment = { id: string; order: number; label: string; amount: number; paidAmount: number; dueDate: Date };

export type PayableInvoice = {
  status: string;
  totalAmount: number;
  paidAmount: number;
  installments: PayableInstallment[];
};

// Unpaid installments in the order the waterfall fills them: due date, then
// plan order.
export function unpaidInOrder(installments: PayableInstallment[]) {
  return [...installments]
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || a.order - b.order)
    .filter((i) => i.paidAmount < i.amount)
    .map((i) => ({ ...i, remaining: i.amount - i.paidAmount }));
}

export type PaymentChoice = { mode: "all" } | { mode: "installments"; ids: string[] };

// The amount to collect for a choice. Installments are paid in order: the
// waterfall credits the earliest unpaid one first, so the choice must be
// the next one, or the next ones, never a later one alone.
export function amountFor(invoice: PayableInvoice, choice: PaymentChoice): { amount: number; installmentIds: string[] } {
  if (invoice.status === "CANCELLED") throw new DomainError("Cette facture est annulée.");
  const rest = remainingDue(invoice);
  if (rest <= 0) throw new DomainError("Cette facture est déjà soldée.");
  const unpaid = unpaidInOrder(invoice.installments);

  if (choice.mode === "all" || unpaid.length === 0) {
    if (choice.mode === "installments" && choice.ids.length) throw new DomainError("Cette facture n'a pas de tranches : réglez le solde.");
    return { amount: rest, installmentIds: unpaid.map((i) => i.id) };
  }

  const wanted = new Set(choice.ids);
  if (!wanted.size) throw new DomainError("Choisissez au moins une tranche.");
  for (const id of wanted) if (!unpaid.some((i) => i.id === id)) throw new DomainError("Une tranche choisie n'existe pas ou est déjà payée.");
  const prefix = unpaid.slice(0, wanted.size);
  const firstMissing = prefix.find((i) => !wanted.has(i.id));
  if (firstMissing) throw new DomainError(`Les tranches se règlent dans l'ordre : ajoutez d'abord « ${firstMissing.label} ».`);
  // Capped by what remains due overall, in case payments outside the
  // schedule already covered part of it.
  const amount = Math.min(
    rest,
    prefix.reduce((s, i) => s + i.remaining, 0),
  );
  return { amount, installmentIds: prefix.map((i) => i.id) };
}

// How a provider status updates ours. Approved is kept once reached (the
// payment is recorded on the invoice), except for a refund. Refunded is
// final. Declined and canceled may still turn into approved: the payer can
// retry on the provider's page.
export function nextStatus(current: OnlineStatus | "CREATED", incoming: OnlineStatus): OnlineStatus | "CREATED" {
  if (current === "REFUNDED") return current;
  if (current === "APPROVED") return incoming === "REFUNDED" ? "REFUNDED" : "APPROVED";
  return incoming;
}

// Transaction references are compared without case, spaces or dashes:
// "MP 2609.1234-AB" and "mp26091234ab" are the same declaration.
export function normalizeTransactionRef(ref: string) {
  return ref.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Benin numbers: 10 digits since 2024 ("01 97 00 00 00"), with or without
// the 229 country code.
export function normalizeBeninPhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("00229")) digits = digits.slice(5);
  else if (digits.startsWith("229") && digits.length > 10) digits = digits.slice(3);
  if (digits.length === 8) digits = `01${digits}`;
  return /^01\d{8}$/.test(digits) ? digits : null;
}

// What a provider state does to an online payment. The Payment is recorded
// once: only on reaching approved, only while none is linked, and only when
// the provider collected exactly the amount and currency we asked for (a
// tampered or partial collection is left for the accountant to check).
export function settlement(
  op: { status: OnlineStatus | "CREATED"; paymentId: string | null; amount: number; currency: string },
  t: { status: OnlineStatus; amount: number; currency: string },
) {
  const matches = t.amount === op.amount && t.currency.toUpperCase() === op.currency.toUpperCase();
  if (!matches) return { status: op.status, record: false, mismatch: true };
  const status = nextStatus(op.status, t.status);
  return { status, record: status === "APPROVED" && !op.paymentId, mismatch: false };
}
