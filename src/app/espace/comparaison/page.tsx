import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { forbidden } from "next/navigation";

import { BarChart } from "@/components/kit/bar-chart";
import { PageHeader } from "@/components/kit/page-header";
import { EmptyState } from "@/components/kit/states";
import { UrlSelect } from "@/components/kit/url-select";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { YEAR_STATUS_LABELS } from "@/features/calendar/rules";
import { ScopeFilter } from "@/features/statistics/components/scope-filter";
import { formatIndicator } from "@/features/statistics/format";
import { ScopeBreadcrumb } from "@/features/territory/components/scope-breadcrumb";
import { communesOf, listDepartments } from "@/features/territory/queries";
import { narrowStatScope } from "@/features/territory/scope";
import { COMPARE_KEYS, COMPARE_LABELS, isCompareKey, trend, type CompareKey } from "@/features/year-compare/compute";
import { COMPARE_CHILD_LABELS, COMPARE_CHILD_SINGULAR, getYearComparison } from "@/features/year-compare/queries";
import { can, ForbiddenError, requirePermission } from "@/lib/auth/authorize";
import { param } from "@/lib/list";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Comparaison des années" };

function Evolution({ k, previous, current }: { k: CompareKey; previous: number | null; current: number | null }) {
  const t = trend(k, previous, current);
  if (!t) return <span className="text-muted">–</span>;
  const Icon = t.direction === "up" ? ArrowUpRight : t.direction === "down" ? ArrowDownRight : ArrowRight;
  const word = t.direction === "up" ? "en hausse" : t.direction === "down" ? "en baisse" : "stable";
  const amount =
    t.direction === "flat" ? "" : k === "enrollments" ? ` ${t.delta > 0 ? "+" : ""}${formatIndicator("enrollments", t.delta)}` : k === "meanAverage" ? ` ${t.delta > 0 ? "+" : ""}${t.delta.toFixed(2).replace(".", ",")}` : ` ${t.delta > 0 ? "+" : ""}${(t.delta * 100).toFixed(1).replace(".", ",")} pt`;
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm font-semibold whitespace-nowrap", t.judgement === "better" ? "text-success" : t.judgement === "worse" ? "text-danger" : "text-text")}>
      <Icon className="size-4" aria-hidden />
      {word}
      {amount}
    </span>
  );
}

export default async function ComparisonPage({ searchParams }: PageProps<"/espace/comparaison">) {
  const user = await requirePermission("statistics:view");
  const sp = await searchParams;
  let narrowed;
  try {
    narrowed = await narrowStatScope(user, { departmentId: param(sp, "departement"), communeId: param(sp, "commune") });
  } catch (error) {
    if (error instanceof ForbiddenError) forbidden();
    throw error;
  }
  const { scope, departmentId, communeId } = narrowed;
  const indicator: CompareKey = isCompareKey(param(sp, "indicateur")) ? (param(sp, "indicateur") as CompareKey) : "passRate";
  const level = user.scope.level;
  const [data, departments, communes] = await Promise.all([
    getYearComparison(scope),
    level === "NATIONAL" ? listDepartments() : Promise.resolve(null),
    (level === "NATIONAL" || level === "DEPARTMENT") && departmentId ? communesOf(departmentId) : Promise.resolve([]),
  ]);
  const years = data.years;
  const last = years.at(-1);
  const first = years[0];
  const activeYear = years.find((y) => y.status === "ACTIVE");

  const drill = (id: string) =>
    data.childLevel === "DEPARTMENT"
      ? `/espace/comparaison?${new URLSearchParams({ departement: id, indicateur: indicator })}`
      : data.childLevel === "COMMUNE"
        ? `/espace/comparaison?${new URLSearchParams({ ...(level === "NATIONAL" && departmentId ? { departement: departmentId } : {}), commune: id, indicateur: indicator })}`
        : data.childLevel === "SCHOOL" && can(user, "school:view")
          ? `/espace/etablissements/${id}`
          : null;

  const meta = COMPARE_LABELS[indicator];
  const chartMax = indicator === "meanAverage" ? 20 : indicator === "absenceRate" ? 0.2 : indicator === "enrollments" ? undefined : 1;

  const filtered = !!departments || communes.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* With filters, the scope and its filters share one panel, as on the
          list pages; without, the territorial trail sits above the title. */}
      <div className="flex flex-col gap-2">
        {!filtered && <ScopeBreadcrumb scope={scope} basePath="/espace/comparaison" user={user} />}
        <PageHeader
          title="Comparaison des années"
          info="Évolution des indicateurs clés d'une année scolaire à l'autre, pour votre périmètre et chacun de ses territoires. Les années closes restent comparables."
        />
      </div>
      {filtered && (
        <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-3 shadow-card sm:p-4 lg:flex-row lg:items-end lg:justify-between">
          <ScopeBreadcrumb scope={scope} basePath="/espace/comparaison" user={user} />
          <ScopeFilter departments={departments?.map((d) => ({ id: d.id, name: d.name })) ?? null} communes={communes} departmentId={departmentId} communeId={communeId} keep={{ indicateur: indicator }} />
        </div>
      )}

      {years.length < 2 ? (
        <EmptyState title="Une seule année scolaire" description="La comparaison apparaîtra dès qu'une deuxième année aura commencé." />
      ) : (
        <>
          <Card aria-labelledby="evolution-title">
            <CardHeader>
              <div>
                <CardTitle id="evolution-title">Évolution du périmètre</CardTitle>
                <CardDescription>
                  Chaque année avec ses propres résultats.{activeYear ? ` Pour ${activeYear.label}, année en cours, les résultats sont provisoires.` : ""}
                </CardDescription>
              </div>
            </CardHeader>
            <CardBody className="overflow-x-auto p-0 sm:p-0">
              <Table density="comfortable">
                <caption className="sr-only">Indicateurs par année scolaire</caption>
                <THead>
                  <tr>
                    <TH>Indicateur</TH>
                    {years.map((y) => (
                      <TH key={y.id} className="text-right">
                        {y.label}
                        <span className="block text-xs font-normal text-muted">{YEAR_STATUS_LABELS[y.status]}</span>
                      </TH>
                    ))}
                    <TH>Sur la période</TH>
                  </tr>
                </THead>
                <tbody>
                  {COMPARE_KEYS.map((k) => (
                    <TR key={k}>
                      <TD className="font-semibold">{COMPARE_LABELS[k].label}</TD>
                      {years.map((y) => (
                        <TD key={y.id} className="text-right tabular-nums">
                          {formatIndicator(k, data.total[y.id]?.[k] ?? null)}
                        </TD>
                      ))}
                      <TD>
                        <Evolution k={k} previous={data.total[first!.id]?.[k] ?? null} current={data.total[last!.id]?.[k] ?? null} />
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </CardBody>
          </Card>

          <Card aria-labelledby="detail-title">
            <CardHeader>
              <div>
                <CardTitle id="detail-title">
                  {meta.label} par {COMPARE_CHILD_SINGULAR[data.childLevel]}
                </CardTitle>
                <CardDescription>
                  {COMPARE_CHILD_LABELS[data.childLevel]} de votre périmètre, de {first!.label} à {last!.label}.
                </CardDescription>
              </div>
              <UrlSelect param="indicateur" label="Indicateur" value={indicator} options={COMPARE_KEYS.map((k) => ({ value: k, label: COMPARE_LABELS[k].label }))} className="sm:w-60" />
            </CardHeader>
            <CardBody className="flex flex-col gap-6">
              <BarChart
                label={`${meta.label} par année`}
                data={years.flatMap((y) => {
                  const value = data.total[y.id]?.[indicator] ?? null;
                  return value === null ? [] : [{ label: y.label, value }];
                })}
                format={(n) => formatIndicator(indicator, n)}
                max={chartMax}
                scale={chartMax === undefined ? undefined : indicator === "meanAverage" ? "Échelle de 0 à 20." : indicator === "absenceRate" ? "Échelle de 0 à 20 %." : "Échelle de 0 à 100 %."}
              />
              {years.some((y) => (data.total[y.id]?.[indicator] ?? null) === null) && (
                <p className="text-sm text-muted">
                  Sans donnée pour {years.filter((y) => (data.total[y.id]?.[indicator] ?? null) === null).map((y) => y.label).join(", ")} : aucun bulletin publié ou aucun appel enregistré.
                </p>
              )}
              <div className="-mx-4 overflow-x-auto sm:-mx-5">
                <Table density="compact">
                  <caption className="sr-only">
                    {meta.label} par {COMPARE_CHILD_SINGULAR[data.childLevel]} et par année
                  </caption>
                  <THead>
                    <tr>
                      <TH>{COMPARE_CHILD_LABELS[data.childLevel]}</TH>
                      {years.map((y) => (
                        <TH key={y.id} className="text-right">
                          {y.label}
                        </TH>
                      ))}
                      <TH>Évolution</TH>
                    </tr>
                  </THead>
                  <tbody>
                    {data.children.map((c) => {
                      const href = drill(c.id);
                      return (
                        <TR key={c.id}>
                          <TD className="font-semibold">
                            {href ? (
                              <Link href={href} className="text-primary hover:underline">
                                {c.name}
                              </Link>
                            ) : (
                              c.name
                            )}
                          </TD>
                          {years.map((y) => (
                            <TD key={y.id} className="text-right tabular-nums">
                              {formatIndicator(indicator, c.byYear[y.id]?.[indicator] ?? null)}
                            </TD>
                          ))}
                          <TD>
                            <Evolution k={indicator} previous={c.byYear[first!.id]?.[indicator] ?? null} current={c.byYear[last!.id]?.[indicator] ?? null} />
                          </TD>
                        </TR>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </CardBody>
          </Card>
          <p className="text-sm text-muted">
            Élèves inscrits et part des filles : inscriptions actives de l&apos;année. Taux de réussite : part des élèves dont la moyenne annuelle (moyenne des bulletins publiés de l&apos;année) atteint 10 sur 20. Taux
            d&apos;absence : demi-journées d&apos;absence, justifiée ou non, sur les demi-journées relevées.
          </p>
        </>
      )}
    </div>
  );
}
