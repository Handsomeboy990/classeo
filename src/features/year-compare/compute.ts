import { computeIndicators, sumCounts, type Indicators, type RawCounts } from "@/lib/domain/indicators";

// Year over year comparison. The same indicator functions as the statistics
// pages (lib/domain/indicators), but each year is read with its own results:
// the pass rate of 2025-2026 is computed from the 2025-2026 report cards.

export const COMPARE_KEYS = ["enrollments", "girlsShare", "passRate", "meanAverage", "absenceRate"] as const;
export type CompareKey = (typeof COMPARE_KEYS)[number];

export const COMPARE_LABELS: Record<CompareKey, { label: string; higherIsBetter: boolean | null }> = {
  enrollments: { label: "Élèves inscrits", higherIsBetter: null },
  girlsShare: { label: "Part des filles", higherIsBetter: null },
  passRate: { label: "Taux de réussite", higherIsBetter: true },
  meanAverage: { label: "Moyenne générale", higherIsBetter: true },
  absenceRate: { label: "Taux d'absence", higherIsBetter: false },
};

export const isCompareKey = (v: unknown): v is CompareKey => typeof v === "string" && (COMPARE_KEYS as readonly string[]).includes(v);

export type CountRow = { yearId: string; childId: string } & Partial<RawCounts>;

export type Comparison = {
  total: Record<string, Indicators>;
  children: { id: string; name: string; byYear: Record<string, Indicators> }[];
};

// Sums raw counts per year for the whole scope and per child territory, then
// turns them into indicators. Children without any data keep empty years.
export function compareYears(rows: CountRow[], yearIds: string[], children: { id: string; name: string }[]): Comparison {
  const byYear = new Map<string, Partial<RawCounts>[]>();
  const byChildYear = new Map<string, Partial<RawCounts>[]>();
  for (const r of rows) {
    byYear.set(r.yearId, [...(byYear.get(r.yearId) ?? []), r]);
    const k = `${r.childId}|${r.yearId}`;
    byChildYear.set(k, [...(byChildYear.get(k) ?? []), r]);
  }
  // sumCounts only reads the RawCounts keys: yearId and childId are ignored.
  const total = Object.fromEntries(yearIds.map((y) => [y, computeIndicators(sumCounts(byYear.get(y) ?? []))]));
  return {
    total,
    children: children.map((c) => ({ ...c, byYear: Object.fromEntries(yearIds.map((y) => [y, computeIndicators(sumCounts(byChildYear.get(`${c.id}|${y}`) ?? []))])) })),
  };
}

export type Trend = { direction: "up" | "down" | "flat"; judgement: "better" | "worse" | "neutral"; delta: number };

// Change from one year to the next. Rates move by percentage points; below
// half a point (or 0.1 of average, or no change in count) it is stable.
export function trend(key: CompareKey, previous: number | null, current: number | null): Trend | null {
  if (previous === null || current === null) return null;
  const delta = current - previous;
  const threshold = key === "enrollments" ? 0.5 : key === "meanAverage" ? 0.1 : 0.005;
  const direction = Math.abs(delta) < threshold ? "flat" : delta > 0 ? "up" : "down";
  const better = COMPARE_LABELS[key].higherIsBetter;
  const judgement = direction === "flat" || better === null ? "neutral" : (direction === "up") === better ? "better" : "worse";
  return { direction, judgement, delta };
}
