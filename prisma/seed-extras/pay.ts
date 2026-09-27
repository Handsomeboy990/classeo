import type { Prisma, PrismaClient } from "../../src/generated/prisma/client";
import { payslipTotals } from "../../src/lib/domain/payroll";

import type { SeedContext } from "./index";

// Payslips kept by schools, deterministic. Agents of the State get none:
// the Ministry of Finance pays them.
// - CEG Godomey pays its vacataires by the hour (2 500 FCFA per hour, four
//   weeks): September validated and paid, October prepared in draft.
// - The first private college of the Atlantique pays its own teachers a
//   monthly salary with a transport allowance and the employee's CNSS
//   contribution (3.6 % of the gross): September validated.
const HOURLY = 2_500;

export async function seedPay(db: PrismaClient, ctx: SeedContext) {
  const rows: Prisma.PayrollCreateManyInput[] = [];
  const add = (t: { id: string; schoolId: string; firstName: string; lastName: string }, month: string, amounts: { baseAmount: number; allowances: number; allowancesNote: string | null; deductions: number; deductionsNote: string | null }, status: "DRAFT" | "APPROVED" | "PAID") => {
    const totals = payslipTotals(amounts);
    rows.push({
      schoolId: t.schoolId,
      teacherId: t.id,
      employeeName: `${t.firstName} ${t.lastName}`,
      month,
      ...amounts,
      ...totals,
      status,
      approvedAt: status === "DRAFT" ? null : new Date(`${month}-28T09:00:00Z`),
      paidAt: status === "PAID" ? new Date(`${month}-30T10:00:00Z`) : null,
      createdById: ctx.ids.accountant,
    });
  };

  const vacataires = await db.teacher.findMany({
    where: { schoolId: ctx.schools.ceg, status: "VACATAIRE", isActive: true },
    select: { id: true, schoolId: true, firstName: true, lastName: true, assignments: { where: { classroom: { academicYearId: ctx.yearId } }, select: { weeklyHours: true } } },
    orderBy: { matricule: "asc" },
  });
  for (const v of vacataires) {
    const hours = Math.max(2, v.assignments.reduce((n, a) => n + a.weeklyHours, 0));
    const amounts = { baseAmount: hours * 4 * HOURLY, allowances: 0, allowancesNote: null, deductions: 0, deductionsNote: null };
    add(v, "2026-09", { ...amounts, allowancesNote: `${hours} heures par semaine à ${HOURLY} FCFA` }, "PAID");
    add(v, "2026-10", amounts, "DRAFT");
  }

  const college = await db.school.findFirst({ where: { sector: { in: ["PRIVATE", "CONFESSIONAL"] }, cycle: "SECONDARY", commune: { department: { name: "Atlantique" } } }, orderBy: { code: "asc" }, select: { id: true } });
  if (college) {
    const staff = await db.teacher.findMany({ where: { schoolId: college.id, status: "PRIVATE", isActive: true }, select: { id: true, schoolId: true, firstName: true, lastName: true, matricule: true }, orderBy: { matricule: "asc" } });
    staff.forEach((t, i) => {
      const baseAmount = 80_000 + (i % 4) * 5_000;
      const allowances = 10_000;
      const deductions = Math.round((baseAmount + allowances) * 0.036);
      add(t, "2026-09", { baseAmount, allowances, allowancesNote: "Indemnité de transport", deductions, deductionsNote: "Cotisation CNSS, part salariale (3,6 %)" }, "APPROVED");
    });
  }
  const current = rows.length;

  // The payslips of the past years, 2022-2023 to 2025-2026, paid: every
  // month of the school year for the teachers the school paid that year
  // (who taught one of its classes), those who have left included. The
  // hourly rate of the vacataires and the salaries rose over the years.
  const years = await db.academicYear.findMany({ where: { isActive: false }, orderBy: { startDate: "asc" }, select: { id: true, label: true } });
  const HOURLY_BY_YEAR: Record<string, number> = { "2022-2023": 2_000, "2023-2024": 2_000, "2024-2025": 2_250, "2025-2026": 2_500 };
  const SALARY_BY_YEAR: Record<string, number> = { "2022-2023": 0.9, "2023-2024": 0.93, "2024-2025": 0.96, "2025-2026": 0.98 };
  const past = (t: { id: string; schoolId: string; firstName: string; lastName: string }, month: string, amounts: { baseAmount: number; allowances: number; allowancesNote: string | null; deductions: number; deductionsNote: string | null }) => {
    const [y, m] = month.split("-").map(Number) as [number, number];
    rows.push({
      schoolId: t.schoolId,
      teacherId: t.id,
      employeeName: `${t.firstName} ${t.lastName}`,
      month,
      ...amounts,
      ...payslipTotals(amounts),
      status: "PAID",
      approvedAt: new Date(Date.UTC(y, m - 1, 25, 9)),
      paidAt: new Date(Date.UTC(y, m - 1, 28, 10)),
      createdById: ctx.ids.accountant,
      createdAt: new Date(Date.UTC(y, m - 1, 22, 8)),
    });
  };
  const monthsOf = (label: string, from: number) => {
    const start = Number(label.slice(0, 4));
    return Array.from({ length: 10 - (from - 9) }, (_, i) => {
      const m = from + i;
      return m <= 12 ? `${start}-${String(m).padStart(2, "0")}` : `${start + 1}-${String(m - 12).padStart(2, "0")}`;
    });
  };
  for (const y of years) {
    const taught = await db.teacher.findMany({
      where: { schoolId: ctx.schools.ceg, status: "VACATAIRE", assignments: { some: { classroom: { academicYearId: y.id } } } },
      select: { id: true, schoolId: true, firstName: true, lastName: true, assignments: { where: { classroom: { academicYearId: y.id } }, select: { weeklyHours: true } } },
      orderBy: { matricule: "asc" },
    });
    const hourly = HOURLY_BY_YEAR[y.label] ?? HOURLY;
    for (const v of taught) {
      const hours = Math.max(2, v.assignments.reduce((n, a) => n + a.weeklyHours, 0));
      for (const month of monthsOf(y.label, 10)) past(v, month, { baseAmount: hours * 4 * hourly, allowances: 0, allowancesNote: `${hours} heures par semaine à ${hourly} FCFA`, deductions: 0, deductionsNote: null });
    }
    if (college) {
      const staff = await db.teacher.findMany({
        where: { schoolId: college.id, status: "PRIVATE", assignments: { some: { classroom: { academicYearId: y.id } } } },
        select: { id: true, schoolId: true, firstName: true, lastName: true },
        orderBy: { matricule: "asc" },
      });
      staff.forEach((t, i) => {
        const baseAmount = Math.round(((80_000 + (i % 4) * 5_000) * (SALARY_BY_YEAR[y.label] ?? 1)) / 500) * 500;
        const allowances = y.label < "2024" ? 8_000 : 10_000;
        const deductions = Math.round((baseAmount + allowances) * 0.036);
        for (const month of monthsOf(y.label, 9)) past(t, month, { baseAmount, allowances, allowancesNote: "Indemnité de transport", deductions, deductionsNote: "Cotisation CNSS, part salariale (3,6 %)" });
      });
    }
  }
  for (let i = 0; i < rows.length; i += 2000) await db.payroll.createMany({ data: rows.slice(i, i + 2000) });
  console.log(`pay: ${current} payslips this year, ${rows.length - current} in the past years`);
}
