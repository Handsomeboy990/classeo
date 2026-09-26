import type { Metadata } from "next";
import { forbidden, redirect } from "next/navigation";

import { PageHeader } from "@/components/kit/page-header";
import { Breakdown } from "@/features/statistics/components/breakdown";
import { IndicatorCards } from "@/features/statistics/components/indicator-cards";
import { sortParams } from "@/features/statistics/params";
import { getStatistics } from "@/features/statistics/queries";
import { ScopeBreadcrumb } from "@/features/territory/components/scope-breadcrumb";
import { can, requirePermission } from "@/lib/auth/authorize";

export const metadata: Metadata = { title: "Territoire" };

// National view: the twelve departments. Territorial agents land on their own
// level instead.
export default async function TerritoryPage({ searchParams }: PageProps<"/espace/territoire">) {
  const user = await requirePermission("territory:view");
  const s = user.scope;
  if (s.level === "DEPARTMENT" && s.departmentId) redirect(`/espace/territoire/${s.departmentId}`);
  if (s.level === "COMMUNE" && s.communeId) redirect(`/espace/territoire/commune/${s.communeId}`);
  if (s.level !== "NATIONAL") forbidden();

  const sp = await searchParams;
  const { sort, direction } = sortParams(sp);
  const stats = await getStatistics({ level: "NATIONAL" });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Territoire national" info="Indicateurs clés des 12 départements du Bénin. Un département ouvre le détail de ses communes." />
      <ScopeBreadcrumb scope={{ level: "NATIONAL" }} basePath="/espace/territoire" user={user} />
      <IndicatorCards stats={stats} requestsHref={can(user, "request:view") ? "/espace/demandes?statut=PENDING" : undefined} />
      <Breakdown
        stats={stats}
        sort={sort}
        direction={direction}
        basePath="/espace/territoire"
        searchParams={sp}
        hrefFor={(id) => `/espace/territoire/${id}`}
        title="Départements"
      />
    </div>
  );
}
