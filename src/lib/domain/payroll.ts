// Payroll of the teachers a school pays. Pure, unit tested.
//
// Agents of the State (APE, ACE, AME) are paid by the Ministry of Finance:
// their payslips are on its portal, reached with their State matricule.
// Classéo keeps no second circuit for them. A school pays its vacataires
// and, when it is private, its own teachers: it keeps their monthly payslip
// here (base, allowances, deductions, net), which the teacher reads in "Ma
// paie".

import { isStateStatus, type TeacherStatus } from "./teacher-status";

export const STATE_PAYSLIP_PORTAL = "https://bulletinpaie.finances.bj";
export const STATE_PAYSLIP_PORTAL_LABEL = "bulletinpaie.finances.bj";

export type PayrollStatus = "DRAFT" | "APPROVED" | "PAID";

export const PAYROLL_STATUS_LABELS: Record<PayrollStatus, string> = {
  DRAFT: "Brouillon",
  APPROVED: "Validé",
  PAID: "Payé",
};

export const PAYROLL_STATUS_TONES = { DRAFT: "neutral", APPROVED: "info", PAID: "success" } as const;

export const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// "2026-09" gives "septembre 2026".
export function monthLabel(month: string) {
  const m = MONTH.exec(month);
  if (!m) return month;
  return `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

// The months of a school year, September to June, as "YYYY-MM".
export function schoolYearMonths(firstYear: number) {
  return [9, 10, 11, 12, 1, 2, 3, 4, 5, 6].map((m) => `${m >= 9 ? firstYear : firstYear + 1}-${String(m).padStart(2, "0")}`);
}

export function payslipTotals(p: { baseAmount: number; allowances: number; deductions: number }) {
  const grossAmount = p.baseAmount + p.allowances;
  return { grossAmount, netAmount: grossAmount - p.deductions };
}

// Why a school may not issue this payslip, or null.
export function payslipError(input: { status: TeacherStatus | null; baseAmount: number; allowances: number; deductions: number }): string | null {
  if (isStateStatus(input.status)) return "Cet enseignant est un agent de l'État : son salaire est versé par le ministère de l'Économie et des Finances, pas par l'établissement.";
  if (!input.status) return "Renseignez d'abord le statut de l'enseignant (vacataire ou enseignant du privé) dans sa fiche.";
  if (input.baseAmount <= 0) return "Le salaire de base doit être supérieur à zéro.";
  if (input.allowances < 0 || input.deductions < 0) return "Les primes et les retenues sont des montants positifs.";
  if (input.deductions > input.baseAmount + input.allowances) return "Les retenues dépassent le salaire brut.";
  return null;
}

// Next status of a payslip: validation then payment, never backwards.
export function nextPayrollStatus(status: PayrollStatus): PayrollStatus | null {
  return status === "DRAFT" ? "APPROVED" : status === "APPROVED" ? "PAID" : null;
}
