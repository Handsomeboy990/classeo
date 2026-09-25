import { describe, expect, it } from "vitest";

import {
  amountInWords,
  assertPaymentAllowed,
  distributePaid,
  formatReference,
  installmentStatus,
  invoiceStatus,
  parseSequence,
  planPercentError,
  splitByPlan,
} from "./payments";

const today = new Date("2026-09-25T10:00:00Z");
const d = (s: string) => new Date(`${s}T00:00:00Z`);

const plan = [
  { id: "t2", order: 2, amount: 4500, dueDate: d("2027-01-15") },
  { id: "t1", order: 1, amount: 12500, dueDate: d("2026-10-09") },
  { id: "t3", order: 3, amount: 3000, dueDate: d("2027-04-16") },
];

describe("distributePaid", () => {
  it("fills installments in due date order, whatever the input order", () => {
    const r = distributePaid(plan, 14000, today);
    expect(r.map((x) => x.id)).toEqual(["t1", "t2", "t3"]);
    expect(r.map((x) => x.paidAmount)).toEqual([12500, 1500, 0]);
    expect(r.map((x) => x.status)).toEqual(["PAID", "PARTIALLY_PAID", "PENDING"]);
  });

  it("marks everything paid when the total is covered", () => {
    const r = distributePaid(plan, 20000, today);
    expect(r.every((x) => x.status === "PAID")).toBe(true);
    expect(r.reduce((s, x) => s + x.paidAmount, 0)).toBe(20000);
  });

  it("never credits more than an installment amount", () => {
    const r = distributePaid(plan, 999999, today);
    expect(r.map((x) => x.paidAmount)).toEqual([12500, 4500, 3000]);
  });

  it("flags unpaid past due installments as overdue", () => {
    const later = new Date("2026-10-10T08:00:00Z");
    const r = distributePaid(plan, 5000, later);
    expect(r[0]).toMatchObject({ id: "t1", paidAmount: 5000, status: "OVERDUE" });
    expect(r[1]!.status).toBe("PENDING");
  });

  it("reverses cleanly when a payment is cancelled (recomputed from the new total)", () => {
    const before = distributePaid(plan, 17000, today);
    const after = distributePaid(plan, 17000 - 6000, today);
    expect(before.map((x) => x.paidAmount)).toEqual([12500, 4500, 0]);
    expect(after.map((x) => x.paidAmount)).toEqual([11000, 0, 0]);
    expect(after.map((x) => x.status)).toEqual(["PARTIALLY_PAID", "PENDING", "PENDING"]);
  });
});

describe("installmentStatus", () => {
  it("is not overdue on its due date, only the day after", () => {
    expect(installmentStatus(100, 0, d("2026-09-25"), today)).toBe("PENDING");
    expect(installmentStatus(100, 0, d("2026-09-24"), today)).toBe("OVERDUE");
    expect(installmentStatus(100, 100, d("2026-09-24"), today)).toBe("PAID");
  });
});

describe("invoiceStatus", () => {
  const base = { totalAmount: 20000, dueDate: d("2027-04-16"), today };
  it("derives pending, partial and paid", () => {
    expect(invoiceStatus({ ...base, paidAmount: 0 })).toBe("PENDING");
    expect(invoiceStatus({ ...base, paidAmount: 100 })).toBe("PARTIALLY_PAID");
    expect(invoiceStatus({ ...base, paidAmount: 20000 })).toBe("PAID");
  });
  it("is overdue when one installment is past due and not fully paid", () => {
    const installments = [
      { amount: 12500, paidAmount: 12000, dueDate: d("2026-09-20") },
      { amount: 7500, paidAmount: 0, dueDate: d("2027-01-15") },
    ];
    expect(invoiceStatus({ ...base, paidAmount: 12000, installments })).toBe("OVERDUE");
    installments[0]!.paidAmount = 12500;
    expect(invoiceStatus({ ...base, paidAmount: 12500, installments })).toBe("PARTIALLY_PAID");
  });
  it("uses the invoice due date when there is no installment", () => {
    expect(invoiceStatus({ ...base, dueDate: d("2026-09-01"), paidAmount: 0 })).toBe("OVERDUE");
  });
  it("keeps a cancelled invoice cancelled", () => {
    expect(invoiceStatus({ ...base, paidAmount: 0, cancelled: true })).toBe("CANCELLED");
  });
});

describe("assertPaymentAllowed", () => {
  const invoice = { status: "PARTIALLY_PAID" as const, totalAmount: 20000, paidAmount: 12500 };
  it("accepts up to the remaining due", () => {
    expect(() => assertPaymentAllowed(invoice, 7500)).not.toThrow();
    expect(() => assertPaymentAllowed(invoice, 1)).not.toThrow();
  });
  it("refuses an amount above the remaining due", () => {
    expect(() => assertPaymentAllowed(invoice, 7501)).toThrow(/dépasse le reste à payer \(7 500 FCFA\)/);
  });
  it("refuses zero, negative and fractional amounts", () => {
    expect(() => assertPaymentAllowed(invoice, 0)).toThrow();
    expect(() => assertPaymentAllowed(invoice, -5)).toThrow();
    expect(() => assertPaymentAllowed(invoice, 10.5)).toThrow();
  });
  it("refuses payments on paid or cancelled invoices", () => {
    expect(() => assertPaymentAllowed({ ...invoice, status: "PAID", paidAmount: 20000 }, 1)).toThrow(/soldée/);
    expect(() => assertPaymentAllowed({ ...invoice, status: "CANCELLED" }, 1)).toThrow(/annulée/);
  });
});

describe("payment plans", () => {
  it("requires whole percentages summing to 100", () => {
    expect(planPercentError([50, 30, 20])).toBeNull();
    expect(planPercentError([50, 30])).toMatch(/80 %/);
    expect(planPercentError([])).not.toBeNull();
    expect(planPercentError([100, 0])).not.toBeNull();
    expect(planPercentError([33.5, 66.5])).not.toBeNull();
  });
  it("splits an amount and puts the rounding remainder on the last installment", () => {
    expect(splitByPlan(15000, [50, 30, 20])).toEqual([7500, 4500, 3000]);
    expect(splitByPlan(10000, [33, 33, 34])).toEqual([3300, 3300, 3400]);
    expect(splitByPlan(1001, [33, 33, 34])).toEqual([330, 330, 341]);
    const shares = splitByPlan(99999, [17, 29, 54]);
    expect(shares.reduce((s, v) => s + v, 0)).toBe(99999);
  });
  it("refuses to split along an invalid plan", () => {
    expect(() => splitByPlan(1000, [60, 30])).toThrow(/100 %/);
  });
});

describe("references", () => {
  it("formats and parses sequences", () => {
    expect(formatReference("FAC", 2026, 42, 4)).toBe("FAC-2026-0042");
    expect(formatReference("PAY", 2026, 123456, 5)).toBe("PAY-2026-123456");
    expect(parseSequence("PAY-2026-00017", "PAY", 2026)).toBe(17);
    expect(parseSequence("PAY-2025-00017", "PAY", 2026)).toBeNull();
  });
});

describe("amountInWords", () => {
  it.each([
    [0, "zéro"],
    [1, "un"],
    [17, "dix-sept"],
    [21, "vingt et un"],
    [71, "soixante et onze"],
    [80, "quatre-vingts"],
    [81, "quatre-vingt-un"],
    [91, "quatre-vingt-onze"],
    [100, "cent"],
    [200, "deux cents"],
    [201, "deux cent un"],
    [1000, "mille"],
    [2500, "deux mille cinq cents"],
    [7500, "sept mille cinq cents"],
    [15000, "quinze mille"],
    [80000, "quatre-vingt mille"],
    [200000, "deux cent mille"],
    [1_000_000, "un million"],
    [2_380_001, "deux millions trois cent quatre-vingt mille un"],
  ])("%i is written %s", (n, words) => {
    expect(amountInWords(n)).toBe(words);
  });
});
