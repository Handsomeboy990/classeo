import { Download } from "lucide-react";
import type { Metadata } from "next";
import { forbidden } from "next/navigation";

import { PageHeader } from "@/components/kit/page-header";
import { ButtonLink } from "@/components/ui/button";
import { YearSelect } from "@/features/calendar/components/year-select";
import { selectedYear } from "@/features/calendar/queries";
import { Breakdown } from "@/features/statistics/components/breakdown";
import { IndicatorCards } from "@/features/statistics/components/indicator-cards";
import { MethodNote } from "@/features/statistics/components/method-note";
import { ScopeFilter } from "@/features/statistics/components/scope-filter";
import { sortParams } from "@/features/statistics/params";
import { getStatistics } from "@/features/statistics/queries";
import { ScopeBreadcrumb } from "@/features/territory/components/scope-breadcrumb";
import { communesOf, listDepartments } from "@/features/territory/queries";
import { narrowStatScope } from "@/features/territory/scope";
import { can, ForbiddenError, requirePermission } from "@/lib/auth/authorize";
import { param } from "@/lib/list";
import { PdfDownloadLink } from "@/lib/pdf/download-link";

export const metadata: Metadata = { title: "Statistiques" };

export default async function StatisticsPage({ searchParams }: PageProps<"/espace/statistiques">) {
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
  const { sort, direction } = sortParams(sp);

  const level = user.scope.level;
  const { year, options: years } = await selectedYear(sp);
  const [stats, departments, communes] = await Promise.all([
    getStatistics(scope, year?.id ?? null),
    level === "NATIONAL" ? listDepartments() : Promise.resolve(null),
    (level === "NATIONAL" || level === "DEPARTMENT") && departmentId ? communesOf(departmentId) : Promise.resolve([]),
  ]);

  const query = new URLSearchParams();
  if (departmentId && level === "NATIONAL") query.set("departement", departmentId);
  if (communeId && (level === "NATIONAL" || level === "DEPARTMENT")) query.set("commune", communeId);
  const exportHref = `/api/export/statistiques${query.size ? `?${query}` : ""}`;

  const hrefFor =
    stats.childLevel === "DEPARTMENT"
      ? (id: string) => withYear(`/espace/statistiques?departement=${id}`)
      : stats.childLevel === "COMMUNE"
        ? (id: string) => withYear(`/espace/statistiques?${new URLSearchParams({ ...(level === "NATIONAL" && departmentId ? { departement: departmentId } : {}), commune: id })}`)
        : stats.childLevel === "SCHOOL" && can(user, "school:view")
          ? (id: string) => `/espace/etablissements/${id}`
          : undefined;

  const keep: Record<string, string> = { tri: sort, ordre: direction, ...(year && !year.isActive ? { annee: year.id } : {}) };
  // Drill down links keep the chosen year.
  const withYear = (href: string) => (year && !year.isActive ? `${href}${href.includes("?") ? "&" : "?"}annee=${year.id}` : href);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Statistiques"
        description={`Année ${stats.yearLabel ?? ""}`}
        info={`Indicateurs clés de votre périmètre. Les résultats d'examen portent sur ${stats.previousYearLabel ?? "l'année précédente"}, la dernière année terminée.`}
        actions={
          can(user, "statistics:export") ? (
            <>
              <ButtonLink href={exportHref} variant="secondary" prefetch={false}>
                <Download aria-hidden /> Exporter en CSV
              </ButtonLink>
              <PdfDownloadLink href={`/api/pdf/statistiques${query.size ? `?${query}` : ""}`} description="indicateurs clés et détail du périmètre affiché" />
            </>
          ) : null
        }
      />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <ScopeBreadcrumb scope={scope} basePath="/espace/statistiques" user={user} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <YearSelect options={years} value={year?.id} />
          {(departments || communes.length > 0) && (
            <ScopeFilter
              departments={departments?.map((d) => ({ id: d.id, name: d.name })) ?? null}
              communes={communes}
              departmentId={departmentId}
              communeId={communeId}
              keep={keep}
            />
          )}
        </div>
      </div>
      <IndicatorCards stats={stats} requestsHref={can(user, "request:view") ? "/espace/demandes?statut=PENDING" : undefined} />
      <Breakdown stats={stats} sort={sort} direction={direction} basePath="/espace/statistiques" searchParams={sp} hrefFor={hrefFor} />
      <MethodNote stats={stats} />
    </div>
  );
}
