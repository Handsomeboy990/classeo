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
  await db.payroll.createMany({ data: rows });
  console.log(`pay: ${rows.length} payslips kept by schools`);
}
