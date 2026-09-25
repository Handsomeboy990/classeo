// Fees and payments business rules, transposed from the scolarite reference
// (Invoice::distributePayment, PaymentService, PaymentPlanService).
// Pure functions only: no database, no framework. Money is integer FCFA.

import { DomainError } from "@/lib/errors";

export const INVOICE_STATUSES = ["PENDING", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"] as const;
export type InvoiceStatusCode = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatusCode, string> = {
  PENDING: "En attente",
  PARTIALLY_PAID: "Partiellement payée",
  PAID: "Soldée",
  OVERDUE: "En retard",
  CANCELLED: "Annulée",
};

export const INSTALLMENT_STATUS_LABELS: Record<InvoiceStatusCode, string> = {
  PENDING: "À venir",
  PARTIALLY_PAID: "Partiellement payée",
  PAID: "Payée",
  OVERDUE: "En retard",
  CANCELLED: "Annulée",
};

export const PAYMENT_METHODS = ["CASH", "MOBILE_MONEY", "BANK_TRANSFER", "CHEQUE"] as const;
export type PaymentMethodCode = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodCode, string> = {
  CASH: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  BANK_TRANSFER: "Virement bancaire",
  CHEQUE: "Chèque",
};

// Calendar day in UTC, "2026-09-25". Due dates are stored at midnight UTC,
// so comparing days avoids time of day and time zone surprises.
export function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function isPastDue(dueDate: Date, today: Date) {
  return dayKey(dueDate) < dayKey(today);
}

export function installmentStatus(amount: number, paidAmount: number, dueDate: Date, today: Date): InvoiceStatusCode {
  if (paidAmount >= amount) return "PAID";
  if (isPastDue(dueDate, today)) return "OVERDUE";
  if (paidAmount > 0) return "PARTIALLY_PAID";
  return "PENDING";
}

export type InstallmentInput = { id: string; order: number; amount: number; dueDate: Date };
export type InstallmentAllocation = { id: string; paidAmount: number; status: InvoiceStatusCode };

// Waterfall: the total paid on the invoice fills installments one after the
// other, in due date order (then plan order). Recomputed from the total each
// time, so recording and cancelling a payment use the same rule and can never
// drift.
export function distributePaid(installments: InstallmentInput[], totalPaid: number, today: Date): InstallmentAllocation[] {
  const sorted = [...installments].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || a.order - b.order);
  let left = Math.max(0, totalPaid);
  return sorted.map((i) => {
    const credit = Math.min(left, i.amount);
    left -= credit;
    return { id: i.id, paidAmount: credit, status: installmentStatus(i.amount, credit, i.dueDate, today) };
  });
}

// Invoice status from its totals and its installments. Overdue as soon as one
// installment is past due and not fully paid.
export function invoiceStatus(input: {
  totalAmount: number;
  paidAmount: number;
  dueDate: Date;
  installments?: { amount: number; paidAmount: number; dueDate: Date }[];
  cancelled?: boolean;
  today: Date;
}): InvoiceStatusCode {
  if (input.cancelled) return "CANCELLED";
  if (input.paidAmount >= input.totalAmount) return "PAID";
  const schedule = input.installments?.length
    ? input.installments
    : [{ amount: input.totalAmount, paidAmount: input.paidAmount, dueDate: input.dueDate }];
  if (schedule.some((i) => i.paidAmount < i.amount && isPastDue(i.dueDate, input.today))) return "OVERDUE";
  return input.paidAmount > 0 ? "PARTIALLY_PAID" : "PENDING";
}

export function remainingDue(invoice: { totalAmount: number; paidAmount: number }) {
  return Math.max(0, invoice.totalAmount - invoice.paidAmount);
}

// Rules a payment must pass before it is recorded.
export function assertPaymentAllowed(invoice: { status: InvoiceStatusCode; totalAmount: number; paidAmount: number }, amount: number) {
  if (invoice.status === "CANCELLED") throw new DomainError("Cette facture est annulée : elle ne peut plus recevoir de paiement.");
  if (invoice.status === "PAID" || remainingDue(invoice) === 0) throw new DomainError("Cette facture est déjà soldée.");
  if (!Number.isInteger(amount) || amount <= 0) throw new DomainError("Le montant doit être un nombre entier de francs, supérieur à zéro.");
  const rest = remainingDue(invoice);
  if (amount > rest)
    throw new DomainError(`Le montant saisi (${groupDigits(amount)} FCFA) dépasse le reste à payer (${groupDigits(rest)} FCFA).`);
}

// Payment plan percentages: whole numbers, each above zero, summing to 100.
export function planPercentError(percents: number[]): string | null {
  if (percents.length === 0) return "Ajoutez au moins une tranche.";
  if (percents.some((p) => !Number.isInteger(p) || p <= 0 || p > 100)) return "Chaque tranche doit représenter entre 1 et 100 %.";
  const sum = percents.reduce((s, p) => s + p, 0);
  if (sum !== 100) return `La somme des tranches doit faire 100 % (actuellement ${sum} %).`;
  return null;
}

// Splits an amount along a plan. Each share is rounded down, and the rounding
// remainder goes on the last installment so the shares always add up.
export function splitByPlan(amount: number, percents: number[]): number[] {
  const error = planPercentError(percents);
  if (error) throw new DomainError(error);
  const shares = percents.map((p) => Math.floor((amount * p) / 100));
  const allocated = shares.slice(0, -1).reduce((s, v) => s + v, 0);
  shares[shares.length - 1] = amount - allocated;
  return shares;
}

// "FAC-2026-0042". The sequence is computed by the caller from the highest
// number already used for the prefix, inside a locked transaction.
export function formatReference(prefix: string, year: number, sequence: number, width: number) {
  return `${prefix}-${year}-${String(sequence).padStart(width, "0")}`;
}

export function parseSequence(reference: string, prefix: string, year: number): number | null {
  const head = `${prefix}-${year}-`;
  if (!reference.startsWith(head)) return null;
  const n = Number.parseInt(reference.slice(head.length), 10);
  return Number.isFinite(n) ? n : null;
}

function groupDigits(n: number) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// Amount in French words for receipts, traditional spelling:
// 21 "vingt et un", 80 "quatre-vingts", 200 "deux cents", 201 "deux cent un",
// 2 000 "deux mille", 2 000 000 "deux millions".
const UNITS = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf",
];
const TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];

function belowHundred(n: number, final: boolean): string {
  if (n < 20) return UNITS[n]!;
  const t = Math.floor(n / 10);
  let u = n % 10;
  if (t === 7 || t === 9) u += 10;
  const tens = TENS[t]!;
  if (u === 0) return t === 8 && final ? "quatre-vingts" : tens;
  if ((u === 1 || u === 11) && t !== 8 && t !== 9) return `${tens} et ${UNITS[u]}`;
  return `${tens}-${UNITS[u]}`;
}

function belowThousand(n: number, final: boolean): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h === 1) parts.push("cent");
  else if (h > 1) parts.push(r === 0 && final ? `${UNITS[h]} cents` : `${UNITS[h]} cent`);
  if (r > 0 || h === 0) parts.push(belowHundred(r, final));
  return parts.join(" ");
}

export function amountInWords(amount: number): string {
  if (!Number.isInteger(amount) || amount < 0) throw new DomainError("Montant invalide.");
  if (amount === 0) return "zéro";
  const billions = Math.floor(amount / 1_000_000_000);
  const millions = Math.floor((amount % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((amount % 1_000_000) / 1000);
  const rest = amount % 1000;
  const parts: string[] = [];
  if (billions) parts.push(`${belowThousand(billions, true)} milliard${billions > 1 ? "s" : ""}`);
  if (millions) parts.push(`${belowThousand(millions, true)} million${millions > 1 ? "s" : ""}`);
  if (thousands) parts.push(thousands === 1 ? "mille" : `${belowThousand(thousands, false)} mille`);
  if (rest) parts.push(belowThousand(rest, true));
  return parts.join(" ");
}
