import { describe, expect, it } from "vitest";

import { monthLabel, nextPayrollStatus, payslipError, payslipTotals, schoolYearMonths } from "./payroll";

describe("payslip", () => {
  it("computes the gross and the net", () => {
    expect(payslipTotals({ baseAmount: 85_000, allowances: 15_000, deductions: 3_600 })).toEqual({ grossAmount: 100_000, netAmount: 96_400 });
  });

  it("never pays an agent of the State through the school", () => {
    expect(payslipError({ status: "APE", baseAmount: 100_000, allowances: 0, deductions: 0 })).toMatch(/ministère de l'Économie et des Finances/);
    expect(payslipError({ status: "AME", baseAmount: 100_000, allowances: 0, deductions: 0 })).not.toBeNull();
    expect(payslipError({ status: "PRIVATE", baseAmount: 100_000, allowances: 0, deductions: 0 })).toBeNull();
    expect(payslipError({ status: "VACATAIRE", baseAmount: 40_000, allowances: 0, deductions: 0 })).toBeNull();
  });

  it("refuses an unknown status, a zero base and deductions above the gross", () => {
    expect(payslipError({ status: null, baseAmount: 100_000, allowances: 0, deductions: 0 })).toMatch(/statut/);
    expect(payslipError({ status: "PRIVATE", baseAmount: 0, allowances: 0, deductions: 0 })).toMatch(/supérieur à zéro/);
    expect(payslipError({ status: "PRIVATE", baseAmount: 10_000, allowances: 1_000, deductions: 12_000 })).toMatch(/dépassent/);
  });

  it("goes from draft to validated to paid, never back", () => {
    expect(nextPayrollStatus("DRAFT")).toBe("APPROVED");
    expect(nextPayrollStatus("APPROVED")).toBe("PAID");
    expect(nextPayrollStatus("PAID")).toBeNull();
  });

  it("names the months of the school year", () => {
    expect(monthLabel("2026-09")).toBe("septembre 2026");
    expect(monthLabel("2027-02")).toBe("février 2027");
    expect(schoolYearMonths(2026)).toEqual(["2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04", "2027-05", "2027-06"]);
  });
});
