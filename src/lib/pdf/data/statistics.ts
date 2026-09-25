import "server-only";

import { CHILD_LABELS, getStatistics } from "@/features/statistics/queries";
import { scopeTitle } from "@/features/territory/queries";
import { narrowStatScope, type StatScope } from "@/features/territory/scope";
import { db } from "@/lib/db";

import type { StatisticsData } from "../documents/statistics";
import type { Issuer } from "../layout";
import type { PdfUser } from "../respond";

import { schoolIssuer, schoolSelect } from "./common";

async function issuerOf(scope: StatScope, name: string): Promise<Issuer> {
  switch (scope.level) {
    case "NATIONAL":
      return { kind: "ministry", name: "Niveau national", detail: "Tous les départements du Bénin" };
    case "DEPARTMENT":
      return { kind: "ministry", name: `Direction départementale, ${name}` };
    case "COMMUNE":
      return { kind: "ministry", name: `Circonscription scolaire, ${name}` };
    case "SCHOOL":
      return schoolIssuer(await db.school.findUniqueOrThrow({ where: { id: scope.id }, select: schoolSelect }));
  }
}

// Statistics of the user's scope, narrowed like the statistics page and the
// CSV export (?departement=, ?commune=), each filter checked against the
// user's territory by narrowStatScope(), which throws outside of it.
export async function loadStatistics(user: PdfUser, sp: URLSearchParams) {
  const { scope } = await narrowStatScope(user, { departmentId: sp.get("departement"), communeId: sp.get("commune") });
  const [stats, title] = await Promise.all([getStatistics(scope), scopeTitle(scope)]);
  const data: StatisticsData = {
    scopeName: title.name,
    trail: title.trail,
    childLabel: CHILD_LABELS[stats.childLevel],
    yearLabel: stats.yearLabel,
    previousYearLabel: stats.previousYearLabel,
    total: stats.total,
    children: stats.children.map((c) => ({ name: c.name, indicators: c.indicators })),
    computedAt: new Date(stats.computedAt),
  };
  return { scope, data, issuer: await issuerOf(scope, title.name), schoolId: scope.level === "SCHOOL" ? scope.id : null };
}
