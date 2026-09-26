import "server-only";

import { schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

type User = NonNullable<CurrentUser>;

export const payslipSelect = {
  id: true,
  month: true,
  baseAmount: true,
  allowances: true,
  allowancesNote: true,
  deductions: true,
  deductionsNote: true,
  grossAmount: true,
  netAmount: true,
  status: true,
  approvedAt: true,
  paidAt: true,
} as const;

// The teachers of the user's school for a month, with their payslip when
// one exists. Agents of the State are listed, marked as paid by the State.
export async function schoolPayroll(user: User, month: string) {
  if (user.scope.level !== "SCHOOL" || !user.scope.schoolId) return null;
  const school = await db.school.findFirst({ where: { AND: [{ id: user.scope.schoolId }, schoolWhere(user)] }, select: { id: true, name: true } });
  if (!school) return null;
  const teachers = await db.teacher.findMany({
    where: { schoolId: school.id, isActive: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      matricule: true,
      status: true,
      specialty: true,
      payrolls: { where: { month }, select: payslipSelect, take: 1 },
    },
  });
  return { school, teachers: teachers.map(({ payrolls, ...t }) => ({ ...t, payslip: payrolls[0] ?? null })) };
}

// "Ma paie": the person's appointments, their State record, and the
// payslips the schools that pay them have validated.
export async function myPay(user: User) {
  const profile = await db.teacherProfile.findUnique({
    where: { userId: user.id },
    select: {
      firstName: true,
      lastName: true,
      stateStatus: true,
      stateMatricule: true,
      teachers: {
        where: { isActive: true },
        orderBy: { school: { name: "asc" } },
        select: {
          id: true,
          status: true,
          matricule: true,
          school: { select: { name: true } },
          payrolls: { where: { status: { in: ["APPROVED", "PAID"] } }, orderBy: { month: "desc" }, take: 24, select: payslipSelect },
        },
      },
    },
  });
  return profile;
}
