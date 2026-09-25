import { Download } from "lucide-react";
import type { Metadata } from "next";
import { forbidden } from "next/navigation";

import { PageHeader } from "@/components/kit/page-header";
import { ButtonLink } from "@/components/ui/button";
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
  const [stats, departments, communes] = await Promise.all([
    getStatistics(scope),
    level === "NATIONAL" ? listDepartments() : Promise.resolve(null),
    (level === "NATIONAL" || level === "DEPARTMENT") && departmentId ? communesOf(departmentId) : Promise.resolve([]),
  ]);

  const query = new URLSearchParams();
  if (departmentId && level === "NATIONAL") query.set("departement", departmentId);
  if (communeId && (level === "NATIONAL" || level === "DEPARTMENT")) query.set("commune", communeId);
  const exportHref = `/api/export/statistiques${query.size ? `?${query}` : ""}`;

  const hrefFor =
    stats.childLevel === "DEPARTMENT"
      ? (id: string) => `/espace/statistiques?departement=${id}`
      : stats.childLevel === "COMMUNE"
        ? (id: string) => `/espace/statistiques?${new URLSearchParams({ ...(level === "NATIONAL" && departmentId ? { departement: departmentId } : {}), commune: id })}`
        : stats.childLevel === "SCHOOL" && can(user, "school:view")
          ? (id: string) => `/espace/etablissements/${id}`
          : undefined;

  const keep: Record<string, string> = { tri: sort, ordre: direction };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Statistiques"
        description={`Indicateurs clés de votre périmètre, année ${stats.yearLabel ?? ""}. Les résultats portent sur ${stats.previousYearLabel ?? "l'année précédente"}.`}
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
      <IndicatorCards stats={stats} requestsHref={can(user, "request:view") ? "/espace/demandes?statut=PENDING" : undefined} />
      <Breakdown stats={stats} sort={sort} direction={direction} basePath="/espace/statistiques" searchParams={sp} hrefFor={hrefFor} />
      <MethodNote stats={stats} />
    </div>
  );
}
