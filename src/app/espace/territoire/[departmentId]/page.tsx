import type { Metadata } from "next";

import { PageHeader } from "@/components/kit/page-header";
import { Breakdown } from "@/features/statistics/components/breakdown";
import { IndicatorCards } from "@/features/statistics/components/indicator-cards";
import { sortParams } from "@/features/statistics/params";
import { getStatistics } from "@/features/statistics/queries";
import { ScopeBreadcrumb } from "@/features/territory/components/scope-breadcrumb";
import { requireDepartmentInScope } from "@/features/territory/scope";
import { can, requirePermission } from "@/lib/auth/authorize";

export const metadata: Metadata = { title: "Département" };

// Communes of a department. An id outside the user's territory renders 403.
export default async function DepartmentPage({ params, searchParams }: PageProps<"/espace/territoire/[departmentId]">) {
  const user = await requirePermission("territory:view");
  const { departmentId } = await params;
  const department = await requireDepartmentInScope(user, departmentId);
  const sp = await searchParams;
  const { sort, direction } = sortParams(sp);
  const stats = await getStatistics({ level: "DEPARTMENT", id: department.id });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Département ${department.name}`} info="Indicateurs du département et comparaison de ses communes." />
      <ScopeBreadcrumb scope={{ level: "DEPARTMENT", id: department.id }} basePath="/espace/territoire" user={user} />
      <IndicatorCards stats={stats} requestsHref={can(user, "request:view") ? "/espace/demandes?statut=PENDING" : undefined} />
      <Breakdown
        stats={stats}
        sort={sort}
        direction={direction}
        basePath={`/espace/territoire/${department.id}`}
        searchParams={sp}
        hrefFor={(id) => `/espace/territoire/commune/${id}`}
        title="Communes"
      />
    </div>
  );
}
