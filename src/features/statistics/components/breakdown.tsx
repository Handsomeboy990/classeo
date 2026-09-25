import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";

import { BarChart } from "@/components/kit/bar-chart";
import { EmptyState } from "@/components/kit/states";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { INDICATORS, sortByIndicator, type IndicatorKey } from "@/lib/domain/indicators";
import type { SearchParams } from "@/lib/list";
import { cn } from "@/lib/utils";

import { CHILD_LABELS, type ScopeStatistics } from "../queries";
import { formatIndicator, indicatorFormatter } from "../format";

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
  const max = meta.format === "percent" ? 1 : meta.format === "average" ? 20 : undefined;
  const chartData = rows
    .filter((r) => r.indicators[activeSort] !== null)
    .map((r) => ({
      label: r.name,
      value: r.indicators[activeSort] as number,
      href: hrefFor?.(r.id),
      tone: meta.higherIsBetter === true && (r.indicators[activeSort] as number) < (activeSort === "passRate" ? 0.5 : 10) ? ("danger" as const) : undefined,
    }));
  const flip = direction === "desc" ? "asc" : "desc";

  return (
    <Card>
      <CardHeader className="flex-col sm:flex-row sm:items-center">
        <div>
          <CardTitle>{title ?? `Comparaison par ${labels.singular.toLowerCase()}`}</CardTitle>
          <p className="mt-0.5 text-sm text-muted">
            {rows.length} {rows.length > 1 ? labels.plural.toLowerCase() : labels.singular.toLowerCase()}, triés par {meta.label.toLowerCase()} ({direction === "desc" ? "décroissant" : "croissant"})
          </p>
        </div>
        <Link
          href={hrefWith(basePath, searchParams, { tri: activeSort, ordre: flip })}
          scroll={false}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong px-3 text-sm font-semibold hover:bg-surface-2"
        >
          {direction === "desc" ? <ArrowDown className="size-4" aria-hidden /> : <ArrowUp className="size-4" aria-hidden />}
          {direction === "desc" ? "Ordre décroissant" : "Ordre croissant"}
        </Link>
      </CardHeader>
      <CardBody className="flex flex-col gap-6">
        <nav aria-label="Indicateur de tri" className="flex flex-wrap gap-2">
          {keys.map((k) => (
            <Link
              key={k}
              href={hrefWith(basePath, searchParams, { tri: k, ordre: k === activeSort ? direction : INDICATORS[k].higherIsBetter === false ? "asc" : "desc" })}
              scroll={false}
              aria-current={k === activeSort ? "true" : undefined}
              className={cn(
                "rounded-full border px-3 py-1 text-sm font-medium",
                k === activeSort ? "border-primary bg-primary text-on-primary" : "border-border-strong hover:bg-surface-2",
              )}
            >
              {INDICATORS[k].short}
            </Link>
          ))}
        </nav>

        {rows.length === 0 ? (
          <EmptyState title="Aucune donnée" description="Aucun territoire ou établissement n'est rattaché à ce périmètre." />
        ) : (
          <>
            {chartData.length > 0 ? (
              <BarChart label={`${meta.label} par ${labels.singular.toLowerCase()}`} data={chartData} format={indicatorFormatter(activeSort)} max={max} />
            ) : (
              <p className="text-sm text-muted">Aucune valeur disponible pour cet indicateur.</p>
            )}
            <Table>
              <caption className="sr-only">
                Indicateurs par {labels.singular.toLowerCase()}, triés par {meta.label.toLowerCase()}
              </caption>
              <THead>
                <tr>
                  <TH>{labels.singular}</TH>
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
                    <TH scope="row" className="text-left font-semibold text-text normal-case">
                      {hrefFor ? (
                        <Link href={hrefFor(r.id)} className="text-primary hover:underline">
                          {r.name}
                        </Link>
                      ) : (
                        r.name
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
