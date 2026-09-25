import "server-only";

import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";

// Writes are refused for a school the ministry chain suspended or closed, and
// for an academic year that is closed (its end date passed or the ministry
// closed it), unless an active extension covers the school. Reading stays
// possible everywhere. Every action writing school data calls this, with the
// school and the academic year of the row it writes, after its scoped query
// found that row.
export async function assertWritable({ schoolId, academicYearId, now = new Date() }: { schoolId: string | null | undefined; academicYearId?: string | null; now?: Date }) {
  if (schoolId) {
    const school = await db.school.findUnique({ where: { id: schoolId }, select: { status: true, statusReason: true } });
    if (school?.status === "SUSPENDED") throw new DomainError(`Établissement suspendu : aucune modification n'est possible.${school.statusReason ? ` Motif : ${school.statusReason}` : ""}`);
    if (school?.status === "CLOSED") throw new DomainError("Établissement fermé : aucune modification n'est possible.");
  }
  const year = academicYearId
    ? await db.academicYear.findUnique({ where: { id: academicYearId }, select: { id: true, endDate: true, closedAt: true, label: true } })
    : await db.academicYear.findFirst({ where: { isActive: true }, select: { id: true, endDate: true, closedAt: true, label: true } });
  if (!year) return;
  if (!isYearClosed(year, now)) return;
  const extension = await db.yearExtension.count({
    where: { academicYearId: year.id, status: "ACTIVE", until: { gte: now }, OR: [{ schoolId: null }, ...(schoolId ? [{ schoolId }] : [])] },
  });
  if (!extension) throw new DomainError(`L'année scolaire ${year.label} est close : elle se consulte mais ne se modifie plus, sauf prolongation accordée par le ministère.`);
}

const DAY_MS = 86_400_000;

// The end date is the last school day: the year stays open until the end of
// that day, then closes on its own. The ministry can close it earlier.
export function isYearClosed(year: { endDate: Date; closedAt: Date | null }, now = new Date()) {
  return (year.closedAt !== null && year.closedAt <= now) || year.endDate.getTime() + DAY_MS <= now.getTime();
}

// Row helpers: they read the school and the year of a row the caller already
// found through its scoped query, then apply assertWritable.

export async function assertClassroomWritable(classroomId: string) {
  const c = await db.classroom.findUnique({ where: { id: classroomId }, select: { schoolId: true, academicYearId: true } });
  if (!c) throw new DomainError("Classe introuvable.");
  await assertWritable(c);
}

export async function assertSheetWritable(sheetId: string) {
  const s = await db.gradeSheet.findUnique({ where: { id: sheetId }, select: { assignment: { select: { classroom: { select: { schoolId: true, academicYearId: true } } } } } });
  if (!s) throw new DomainError("Fiche de notes introuvable.");
  await assertWritable(s.assignment.classroom);
}

export async function assertEnrollmentWritable(enrollmentId: string) {
  const e = await db.enrollment.findUnique({ where: { id: enrollmentId }, select: { schoolId: true, academicYearId: true } });
  if (!e) throw new DomainError("Inscription introuvable.");
  await assertWritable(e);
}

export async function assertInvoiceWritable(invoiceId: string) {
  const i = await db.invoice.findUnique({ where: { id: invoiceId }, select: { schoolId: true, enrollment: { select: { academicYearId: true } } } });
  if (!i) throw new DomainError("Facture introuvable.");
  await assertWritable({ schoolId: i.schoolId, academicYearId: i.enrollment.academicYearId });
}
