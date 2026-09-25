import type { Metadata } from "next";
import Link from "next/link";

import { DataTable, type Column } from "@/components/kit/data-table";
import { PageHeader } from "@/components/kit/page-header";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { RequestFormDialog } from "@/features/requests/components/request-form-dialog";
import { REQUEST_STATUS_LABELS, REQUEST_STATUS_TONES, REQUEST_STATUSES, REQUEST_TYPE_LABELS, REQUEST_TYPES } from "@/features/requests/labels";
import { listRequests, requestFilters } from "@/features/requests/queries";
import { FilterBar } from "@/features/territory/components/filter-bar";
import { can, requirePermission } from "@/lib/auth/authorize";
import { listParams } from "@/lib/list";

export const metadata: Metadata = { title: "Demandes" };

type Row = Awaited<ReturnType<typeof listRequests>>["rows"][number];

export default async function RequestsPage({ searchParams }: PageProps<"/espace/demandes">) {
  const user = await requirePermission("request:view");
  const sp = await searchParams;
  const filters = requestFilters(sp);
  const page = listParams(sp);
  const { rows, total, byStatus } = await listRequests(user, filters, page);
  const isSchool = user.scope.level === "SCHOOL";

  const columns: Column<Row>[] = [
    {
      header: "Objet",
      cell: (r) => (
        <div>
          <Link href={`/espace/demandes/${r.id}`} className="font-semibold text-primary hover:underline">
            {r.subject}
          </Link>
          <p className="text-xs text-muted">{REQUEST_TYPE_LABELS[r.type]}</p>
        </div>
      ),
    },
    ...(isSchool ? [] : [{ header: "Établissement", cell: (r: Row) => `${r.school.name} (${r.school.commune.name})`, hideBelow: "md" as const }]),
    { header: "Déposée le", cell: (r) => formatDate(r.createdAt), hideBelow: "sm" },
    { header: "Auteur", cell: (r) => `${r.author.firstName} ${r.author.lastName}`, hideBelow: "lg" },
    { header: "Statut", cell: (r) => <Badge tone={REQUEST_STATUS_TONES[r.status]}>{REQUEST_STATUS_LABELS[r.status]}</Badge> },
  ];

  const tabs = [{ value: null, label: "Toutes", count: Object.values(byStatus).reduce((a, b) => a + (b ?? 0), 0) }, ...REQUEST_STATUSES.map((s) => ({ value: s, label: REQUEST_STATUS_LABELS[s], count: byStatus[s] ?? 0 }))];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Demandes"
        description={isSchool ? "Demandes de votre établissement au ministère et décisions reçues." : "Demandes des établissements de votre périmètre. Statuez avec une note motivée."}
        actions={can(user, "request:create") && isSchool ? <RequestFormDialog /> : null}
      />
      <nav aria-label="Filtrer par statut" className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const current = filters.status === t.value;
          const q = new URLSearchParams();
          if (t.value) q.set("statut", t.value);
          if (filters.type) q.set("type", filters.type);
          return (
            <Link
              key={t.label}
              href={`/espace/demandes${q.size ? `?${q}` : ""}`}
              aria-current={current ? "page" : undefined}
              className={cn("rounded-full border px-3 py-1.5 text-sm font-semibold", current ? "border-primary bg-primary text-on-primary" : "border-border-strong hover:bg-surface-2")}
            >
              {t.label} <span className="tabular-nums opacity-80">({formatNumber(t.count)})</span>
            </Link>
          );
        })}
      </nav>
      <FilterBar
        basePath="/espace/demandes"
        keep={{ q: filters.q, statut: filters.status }}
        fields={[{ kind: "select", name: "type", label: "Type", value: filters.type, allLabel: "Tous les types", options: REQUEST_TYPES.map((t) => ({ value: t, label: REQUEST_TYPE_LABELS[t] })) }]}
      />
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        total={total}
        page={page.page}
        pageSize={page.pageSize}
        searchParams={sp}
        basePath="/espace/demandes"
        searchPlaceholder="Rechercher par objet ou établissement…"
        caption="Demandes des établissements"
        emptyTitle="Aucune demande"
        emptyDescription={filters.status ? "Aucune demande avec ce statut dans votre périmètre." : "Aucune demande n'a encore été déposée."}
      />
    </div>
  );
}
