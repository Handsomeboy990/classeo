import type { PrismaClient } from "../../src/generated/prisma/client";
import { yearlyAverage } from "../../src/lib/domain/periodicity";

import type { SeedContext } from "./index";

// Last year's class council decisions of CEG Godomey, from the published
// report cards (article 59 of order n° 029 of 2024). Every seeded pupil
// moved up a class this year, so only the pupils with at least 10/20 carry
// a recorded passage; the others are left without a decision rather than
// with one the data would contradict.
export async function seedCouncil(db: PrismaClient, ctx: SeedContext) {
  const prevYear = await db.academicYear.findFirst({ where: { id: { not: ctx.yearId }, isActive: false }, orderBy: { startDate: "desc" }, select: { id: true } });
  if (!prevYear) return;
  const enrollments = await db.enrollment.findMany({
    where: { schoolId: ctx.schools.ceg, academicYearId: prevYear.id },
    select: { id: true, reportCards: { select: { generalAverage: true, period: { select: { periodicity: true, order: true } } } } },
  });
  const rows = enrollments.flatMap((e) => {
    const average = yearlyAverage(e.reportCards.map((c) => ({ periodicity: c.period.periodicity, order: c.period.order, average: c.generalAverage === null ? null : Number(c.generalAverage) })));
    return average !== null && average >= 10
      ? [{ enrollmentId: e.id, decision: "PROMOTED" as const, yearlyAverage: average, decidedById: ctx.ids.director, decidedAt: new Date("2026-06-30T10:00:00Z") }]
      : [];
  });
  await db.classCouncilDecision.createMany({ data: rows });
  console.log(`council: ${rows.length} decisions for 2025-2026`);
}
