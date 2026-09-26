import type { Metadata } from "next";

import { PageHeader } from "@/components/kit/page-header";
import { Breakdown } from "@/features/statistics/components/breakdown";
import { IndicatorCards } from "@/features/statistics/components/indicator-cards";
import { sortParams } from "@/features/statistics/params";
import { getStatistics } from "@/features/statistics/queries";
import { ScopeBreadcrumb } from "@/features/territory/components/scope-breadcrumb";
import { requireCommuneInScope } from "@/features/territory/scope";
import { can, requirePermission } from "@/lib/auth/authorize";

export const metadata: Metadata = { title: "Commune" };

// Schools of a commune. An id outside the user's territory renders 403.
export default async function CommunePage({ params, searchParams }: PageProps<"/espace/territoire/commune/[communeId]">) {
  const user = await requirePermission("territory:view");
  const { communeId } = await params;
  const commune = await requireCommuneInScope(user, communeId);
  const sp = await searchParams;
  const { sort, direction } = sortParams(sp);
  const stats = await getStatistics({ level: "COMMUNE", id: commune.id });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Commune ${/^[AEIOUYÀÂÉÈÊÎÔ]/i.test(commune.name) ? "d’" : "de "}${commune.name}`} description={`Département ${commune.department.name}`} info="Indicateurs de la commune et de chacun de ses établissements." />
      <ScopeBreadcrumb scope={{ level: "COMMUNE", id: commune.id }} basePath="/espace/territoire" user={user} />
      <IndicatorCards stats={stats} requestsHref={can(user, "request:view") ? "/espace/demandes?statut=PENDING" : undefined} />
      <Breakdown
        stats={stats}
        sort={sort}
        direction={direction}
        basePath={`/espace/territoire/commune/${commune.id}`}
        searchParams={sp}
        hrefFor={can(user, "school:view") ? (id) => `/espace/etablissements/${id}` : undefined}
        title="Établissements"
      />
    </div>
  );
}
