import { describe, expect, it } from "vitest";

import { amountFor, nextStatus, normalizeBeninPhone, normalizeTransactionRef, settlement, unpaidInOrder, type PayableInvoice } from "./rules";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

// 150 000 FCFA in three installments; the first one is half paid.
function invoice(overrides: Partial<PayableInvoice> = {}): PayableInvoice {
  return {
    status: "PARTIALLY_PAID",
    totalAmount: 150_000,
    paidAmount: 25_000,
    installments: [
      { id: "t3", order: 3, label: "Tranche 3", amount: 50_000, paidAmount: 0, dueDate: d("2027-03-15") },
      { id: "t1", order: 1, label: "Tranche 1", amount: 50_000, paidAmount: 25_000, dueDate: d("2026-10-15") },
      { id: "t2", order: 2, label: "Tranche 2", amount: 50_000, paidAmount: 0, dueDate: d("2026-12-15") },
    ],
    ...overrides,
  };
}

describe("unpaidInOrder", () => {
  it("lists unpaid installments in due date order with what remains", () => {
    expect(unpaidInOrder(invoice().installments).map((i) => [i.id, i.remaining])).toEqual([
      ["t1", 25_000],
      ["t2", 50_000],
      ["t3", 50_000],
    ]);
  });
});

describe("amountFor", () => {
  it("collects the whole balance", () => {
    expect(amountFor(invoice(), { mode: "all" })).toEqual({ amount: 125_000, installmentIds: ["t1", "t2", "t3"] });
  });

  it("collects the next installment, or the next ones", () => {
    expect(amountFor(invoice(), { mode: "installments", ids: ["t1"] })).toEqual({ amount: 25_000, installmentIds: ["t1"] });
    expect(amountFor(invoice(), { mode: "installments", ids: ["t2", "t1"] })).toEqual({ amount: 75_000, installmentIds: ["t1", "t2"] });
  });

  it("refuses a later installment before an earlier one", () => {
    expect(() => amountFor(invoice(), { mode: "installments", ids: ["t2"] })).toThrow(/Tranche 1/);
    expect(() => amountFor(invoice(), { mode: "installments", ids: ["t1", "t3"] })).toThrow(/Tranche 2/);
  });

  it("refuses unknown, paid or empty choices", () => {
    expect(() => amountFor(invoice(), { mode: "installments", ids: ["x"] })).toThrow(/n'existe pas/);
    expect(() => amountFor(invoice(), { mode: "installments", ids: [] })).toThrow(/au moins une/);
  });

  it("never asks more than what remains due", () => {
    // A payment outside the schedule already covered more than the rows show.
    expect(amountFor(invoice({ paidAmount: 140_000 }), { mode: "installments", ids: ["t1"] }).amount).toBe(10_000);
  });

  it("refuses settled and cancelled invoices", () => {
    expect(() => amountFor(invoice({ paidAmount: 150_000 }), { mode: "all" })).toThrow(/soldée/);
    expect(() => amountFor(invoice({ status: "CANCELLED" }), { mode: "all" })).toThrow(/annulée/);
  });

  it("collects the balance of an invoice without installments", () => {
    expect(amountFor(invoice({ installments: [] }), { mode: "all" })).toEqual({ amount: 125_000, installmentIds: [] });
  });
});

describe("nextStatus", () => {
  it("follows the provider until approved, then only a refund moves it", () => {
    expect(nextStatus("CREATED", "PENDING")).toBe("PENDING");
    expect(nextStatus("PENDING", "DECLINED")).toBe("DECLINED");
    expect(nextStatus("DECLINED", "APPROVED")).toBe("APPROVED");
    expect(nextStatus("APPROVED", "PENDING")).toBe("APPROVED");
    expect(nextStatus("APPROVED", "CANCELED")).toBe("APPROVED");
    expect(nextStatus("APPROVED", "REFUNDED")).toBe("REFUNDED");
    expect(nextStatus("REFUNDED", "APPROVED")).toBe("REFUNDED");
  });
});

describe("settlement", () => {
  const op = { status: "PENDING" as const, paymentId: null, amount: 25_000, currency: "XOF" };

  it("records the payment on approval", () => {
    expect(settlement(op, { status: "APPROVED", amount: 25_000, currency: "XOF" })).toEqual({ status: "APPROVED", record: true, mismatch: false });
  });

  it("is idempotent: a second approval records nothing", () => {
    const after = { ...op, status: "APPROVED" as const, paymentId: "pay1" };
    expect(settlement(after, { status: "APPROVED", amount: 25_000, currency: "XOF" })).toEqual({ status: "APPROVED", record: false, mismatch: false });
  });

  it("records nothing while pending or declined", () => {
    expect(settlement(op, { status: "PENDING", amount: 25_000, currency: "XOF" }).record).toBe(false);
    expect(settlement(op, { status: "DECLINED", amount: 25_000, currency: "XOF" }).record).toBe(false);
  });

  it("never records an amount or a currency other than asked", () => {
    expect(settlement(op, { status: "APPROVED", amount: 100, currency: "XOF" })).toEqual({ status: "PENDING", record: false, mismatch: true });
    expect(settlement(op, { status: "APPROVED", amount: 25_000, currency: "EUR" }).record).toBe(false);
  });
});

describe("normalizers", () => {
  it("compares transaction references without case or separators", () => {
    expect(normalizeTransactionRef(" mp 2609.1234-ab ")).toBe("MP26091234AB");
  });

  it("reads Benin phone numbers", () => {
    expect(normalizeBeninPhone("01 97 00 00 00")).toBe("0197000000");
    expect(normalizeBeninPhone("+229 01 97 00 00 00")).toBe("0197000000");
    expect(normalizeBeninPhone("97000000")).toBe("0197000000");
    expect(normalizeBeninPhone("12345")).toBeNull();
  });
});
