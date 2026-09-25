import "server-only";

import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";

// Writes are refused for a school the ministry chain suspended or closed, and
// for an academic year that is closed (its end date passed or the ministry
// closed it), unless an active extension covers the school. Reading stays
// possible everywhere. Every action writing school data calls this.
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

export function isYearClosed(year: { endDate: Date; closedAt: Date | null }, now = new Date()) {
  return (year.closedAt !== null && year.closedAt <= now) || year.endDate < now;
}
