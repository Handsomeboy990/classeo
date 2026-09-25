import "server-only";

import { paymentWhere, startOfToday } from "@/features/fees/access";
import { getInvoice } from "@/features/fees/queries";
import { db } from "@/lib/db";
import { installmentStatus } from "@/lib/domain/payments";

import type { InvoiceData, ReceiptData } from "../documents/payments";
import type { PdfUser } from "../respond";

import { schoolIssuer, schoolSelect, validId } from "./common";

// A receipt through paymentWhere(): staff of the school, or the family of
// the student billed, never anyone else.
export async function loadReceipt(user: PdfUser, id: string) {
  if (!validId(id)) return null;
  const p = await db.payment.findFirst({
    where: { AND: [{ id }, paymentWhere(user)] },
    include: {
      recordedBy: { select: { firstName: true, lastName: true } },
      invoice: {
        select: {
          id: true,
          number: true,
          totalAmount: true,
          paidAmount: true,
          school: { select: schoolSelect },
          items: { select: { description: true }, orderBy: { description: "asc" } },
          enrollment: { select: { student: { select: { firstName: true, lastName: true, matricule: true } }, classroom: { select: { name: true } }, academicYear: { select: { label: true } } } },
        },
      },
    },
  });
  if (!p) return null;
  const data: ReceiptData = {
    reference: p.reference,
    amount: p.amount,
    method: p.method,
    transactionId: p.transactionId,
    paidAt: p.paidAt,
    createdAt: p.createdAt,
    recordedBy: `${p.recordedBy.firstName} ${p.recordedBy.lastName}`,
    invoice: { number: p.invoice.number, totalAmount: p.invoice.totalAmount, paidAmount: p.invoice.paidAmount, items: p.invoice.items },
    student: p.invoice.enrollment.student,
    classroom: p.invoice.enrollment.classroom.name,
    yearLabel: p.invoice.enrollment.academicYear.label,
  };
  return { id: p.id, invoiceId: p.invoice.id, data, schoolId: p.invoice.school.id, issuer: schoolIssuer(p.invoice.school) };
}

// An invoice through getInvoice(), which applies invoiceWhere().
export async function loadInvoice(user: PdfUser, id: string) {
  if (!validId(id)) return null;
  const invoice = await getInvoice(user, id);
  if (!invoice) return null;
  const [school, guardian] = await Promise.all([
    db.school.findUniqueOrThrow({ where: { id: invoice.schoolId }, select: schoolSelect }),
    db.studentGuardian.findFirst({
      where: { studentId: invoice.enrollment.student.id },
      orderBy: { isPrimary: "desc" },
      select: { guardian: { select: { firstName: true, lastName: true, phone: true } } },
    }),
  ]);
  const today = startOfToday();
  const cancelled = invoice.status === "CANCELLED";
  const data: InvoiceData = {
    number: invoice.number,
    status: invoice.effectiveStatus,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    totalAmount: invoice.totalAmount,
    paidAmount: invoice.paidAmount,
    student: invoice.enrollment.student,
    classroom: invoice.enrollment.classroom.name,
    yearLabel: invoice.enrollment.academicYear.label,
    guardian: guardian ? { name: `${guardian.guardian.firstName} ${guardian.guardian.lastName}`, phone: guardian.guardian.phone } : null,
    items: invoice.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
    installments: invoice.installments.map((i) => ({
      label: i.label,
      dueDate: i.dueDate,
      amount: i.amount,
      paidAmount: i.paidAmount,
      status: cancelled ? "CANCELLED" : installmentStatus(i.amount, i.paidAmount, i.dueDate, today),
    })),
    payments: [...invoice.payments]
      .sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime())
      .map((p) => ({ reference: p.reference, paidAt: p.paidAt, amount: p.amount, method: p.method, transactionId: p.transactionId })),
  };
  return { id: invoice.id, data, schoolId: school.id, issuer: schoolIssuer(school) };
}
