import "server-only";

import { schoolWhere } from "@/lib/auth/scope";
import { db } from "@/lib/db";

import { monthLabel } from "@/lib/domain/payroll";

import { payslipPdf, type PayslipData } from "../documents/payslip";
import { documentReference, pdfFileName } from "../format";
import type { PdfUser } from "../respond";

import { schoolIssuer, schoolSelect, validId } from "./common";

const select = {
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
  school: { select: schoolSelect },
  teacher: { select: { firstName: true, lastName: true, matricule: true, status: true, specialty: true } },
} as const;

type Row = { id: string; school: Parameters<typeof schoolIssuer>[0] & { id: string }; teacher: PayslipData["teacher"] | null } & Omit<PayslipData, "teacher">;

function toPrintable(p: Row | null) {
  if (!p || !p.teacher) return null;
  const { id, school, teacher, ...rest } = p;
  return { id, data: { ...rest, teacher }, schoolId: school.id, issuer: schoolIssuer(school) };
}

// A payslip for the staff of its school.
export async function loadSchoolPayslip(user: PdfUser, id: string) {
  if (!validId(id) || user.scope.level !== "SCHOOL") return null;
  const p = await db.payroll.findFirst({ where: { id, school: { AND: [{ id: user.scope.schoolId ?? "__none__" }, schoolWhere(user)] } }, select });
  return toPrintable(p);
}

// A teacher's own validated payslip, whatever school issued it.
export async function loadOwnPayslip(user: PdfUser, id: string) {
  if (!validId(id)) return null;
  const p = await db.payroll.findFirst({ where: { id, status: { in: ["APPROVED", "PAID"] }, teacher: { profile: { userId: user.id } } }, select });
  return toPrintable(p);
}

// The document of a payslip, shared by the school and the teacher routes.
export function payslipDocument(
  { id, data, issuer, schoolId }: NonNullable<ReturnType<typeof toPrintable>>,
  generatedAt: Date,
  generatedBy: { name: string; role: string; email: string },
) {
  const reference = documentReference("PAI", generatedAt, id);
  const t = data.teacher;
  const meta = { title: "Bulletin de paie", subtitle: monthLabel(data.month), reference, generatedAt, generatedBy, issuer };
  return {
    element: payslipPdf(data, meta),
    kind: "bulletin_paie" as const,
    title: `Bulletin de paie de ${t.lastName} ${t.firstName}, ${monthLabel(data.month)}`,
    fileName: pdfFileName("bulletin-de-paie", data.month, t.lastName, t.firstName),
    reference,
    summary: `bulletin de paie de ${t.lastName} ${t.firstName}, ${monthLabel(data.month)}`,
    resourceId: id,
    schoolId,
  };
}
