import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";

import { BarChart } from "@/components/kit/bar-chart";
import { EmptyState } from "@/components/kit/states";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { INDICATORS, sortByIndicator, type IndicatorKey } from "@/lib/domain/indicators";
import type { SearchParams } from "@/lib/list";
import { cn } from "@/lib/utils";

import { SchoolStatusBadge } from "@/features/school-status/components/status-badge";
import { CHILD_LABELS, type ScopeStatistics } from "../queries";
import { ABSENCE_SCALE, absenceTone, formatIndicator, indicatorFormatter } from "../format";

const TABLE_KEYS: IndicatorKey[] = [
  "schools",
  "enrollments",
  "girlsShare",
  "disabled",
  "teachers",
  "studentsPerTeacher",
  "averageClassSize",
  "absenceRate",
  "passRate",
  "meanAverage",
  "pendingRequests",
];

export const SORTABLE_KEYS = TABLE_KEYS;

function hrefWith(basePath: string, searchParams: SearchParams, patch: Record<string, string | null>) {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) if (typeof v === "string") next.set(k, v);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) next.delete(k);
    else next.set(k, v);
  }
  const qs = next.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

// Comparison of the child territories of a scope (departments, communes,
// schools or classes): bars for the selected indicator and a full table,
// both sorted by that indicator. Sorting lives in the URL (?tri=&ordre=).
export function Breakdown({
  stats,
  sort,
  direction,
  basePath,
  searchParams,
  hrefFor,
  title,
}: {
  stats: ScopeStatistics;
  sort: IndicatorKey;
  direction: "asc" | "desc";
  basePath: string;
  searchParams: SearchParams;
  hrefFor?: (id: string) => string;
  title?: string;
}) {
  const labels = CHILD_LABELS[stats.childLevel];
  const keys = TABLE_KEYS.filter((k) => !(k === "schools" && (stats.childLevel === "SCHOOL" || stats.childLevel === "CLASS")) && !(k === "pendingRequests" && stats.childLevel === "CLASS"));
  const activeSort = keys.includes(sort) ? sort : "enrollments";
  const rows = sortByIndicator(stats.children, activeSort, direction);
  const meta = INDICATORS[activeSort];
  const absence = activeSort === "absenceRate";
  const max = absence ? ABSENCE_SCALE : meta.format === "percent" ? 1 : meta.format === "average" ? 20 : undefined;
  const scale = absence
    ? "Échelle de 0 à 20 %, en rouge au-delà de 10 %."
    : meta.format === "percent"
      ? "Échelle de 0 à 100 %."
      : meta.format === "average"
        ? "Échelle de 0 à 20."
        : undefined;
  const chartData = rows
    .filter((r) => r.indicators[activeSort] !== null)
    .map((r) => {
      const value = r.indicators[activeSort] as number;
      return {
        label: r.name,
        value,
        href: hrefFor?.(r.id),
        tone: absence ? absenceTone(value) : meta.higherIsBetter === true && value < (activeSort === "passRate" ? 0.5 : 10) ? ("danger" as const) : undefined,
      };
    });
  const flip = direction === "desc" ? "asc" : "desc";

  return (
    <Card className="min-w-0">
      <CardHeader className="flex-col sm:flex-row sm:items-center">
        <div className="min-w-0">
          <CardTitle>{title ?? `Comparaison par ${labels.singular.toLowerCase()}`}</CardTitle>
          <p className="mt-0.5 text-sm text-muted">
            {rows.length} {rows.length > 1 ? labels.plural.toLowerCase() : labels.singular.toLowerCase()}, {stats.childLevel === "COMMUNE" || stats.childLevel === "CLASS" ? "triées" : "triés"} par {meta.label.toLowerCase()} ({direction === "desc" ? "décroissant" : "croissant"})
          </p>
        </div>
        <ButtonLink href={hrefWith(basePath, searchParams, { tri: activeSort, ordre: flip })} scroll={false} variant="secondary" size="sm">
          {direction === "desc" ? <ArrowDown aria-hidden /> : <ArrowUp aria-hidden />}
          {direction === "desc" ? "Ordre décroissant" : "Ordre croissant"}
        </ButtonLink>
      </CardHeader>
      <CardBody className="flex flex-col gap-6">
        {/* A segmented filter: it wraps from 40rem, and scrolls sideways on
            a phone so the chart stays on the first screen. */}
        <nav aria-label="Indicateur de tri" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="ds-segmented max-sm:flex-nowrap">
            {keys.map((k) => (
              <Link
                key={k}
                href={hrefWith(basePath, searchParams, { tri: k, ordre: k === activeSort ? direction : INDICATORS[k].higherIsBetter === false ? "asc" : "desc" })}
                scroll={false}
                aria-current={k === activeSort ? "true" : undefined}
                className="shrink-0 whitespace-nowrap"
              >
                {INDICATORS[k].short}
              </Link>
            ))}
          </div>
        </nav>

        {rows.length === 0 ? (
          <EmptyState title="Aucune donnée" description="Aucun territoire ou établissement n'est rattaché à ce périmètre." />
        ) : (
          <>
            {chartData.length > 0 ? (
              <BarChart label={`${meta.label} par ${labels.singular.toLowerCase()}`} data={chartData} format={indicatorFormatter(activeSort)} max={max} scale={scale} />
            ) : (
              <p className="text-sm text-muted">Aucune valeur disponible pour cet indicateur.</p>
            )}
            {/* On a phone the grid scrolls sideways; the name column stays pinned. */}
            <Table>
              <caption className="sr-only">
                Indicateurs par {labels.singular.toLowerCase()}, {stats.childLevel === "COMMUNE" || stats.childLevel === "CLASS" ? "triées" : "triés"} par {meta.label.toLowerCase()}
              </caption>
              <THead>
                <tr>
                  <TH className="max-sm:sticky max-sm:left-0 max-sm:z-1 max-sm:bg-surface-2">{labels.singular}</TH>
                  {keys.map((k) => (
                    <TH key={k} className="text-right" aria-sort={k === activeSort ? (direction === "desc" ? "descending" : "ascending") : undefined}>
                      <Link href={hrefWith(basePath, searchParams, { tri: k, ordre: k === activeSort ? flip : "desc" })} scroll={false} className="hover:underline" title={INDICATORS[k].label}>
                        {INDICATORS[k].short}
                      </Link>
                    </TH>
                  ))}
                </tr>
              </THead>
              <tbody>
                {rows.map((r) => (
                  <TR key={r.id}>
                    <TH scope="row" className="min-w-32 text-left font-semibold text-text normal-case max-sm:sticky max-sm:left-0 max-sm:z-1 max-sm:bg-surface">
                      {hrefFor ? (
                        <Link href={hrefFor(r.id)} className="text-primary hover:underline">
                          {r.name}
                        </Link>
                      ) : (
                        r.name
                      )}
                      {r.status && r.status !== "ACTIVE" && (
                        <span className="ml-2 inline-block align-middle">
                          <SchoolStatusBadge status={r.status} />
                        </span>
                      )}
                    </TH>
                    {keys.map((k) => (
                      <TD key={k} className={cn("text-right whitespace-nowrap tabular-nums", k === activeSort && "font-semibold")}>
                        {formatIndicator(k, r.indicators[k])}
                      </TD>
                    ))}
                  </TR>
                ))}
              </tbody>
            </Table>
          </>
        )}
      </CardBody>
    </Card>
  );
}
