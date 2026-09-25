import { Download } from "lucide-react";
import type { Metadata } from "next";

import { DataTable, type Column } from "@/components/kit/data-table";
import { PageHeader } from "@/components/kit/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { actionLabel, auditFilterOptions, auditFilters, listAudit, resourceLabel } from "@/features/audit/queries";
import { FilterBar } from "@/features/territory/components/filter-bar";
import { can, requirePermission } from "@/lib/auth/authorize";
import { listParams } from "@/lib/list";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Journal d'activité" };

type Row = Awaited<ReturnType<typeof listAudit>>["rows"][number];

const TONES: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  create: "success",
  update: "info",
  delete: "danger",
  deactivate: "danger",
  denied: "danger",
  login_failed: "warning",
  reset_password: "warning",
  revoke_sessions: "warning",
  export: "neutral",
};

export default async function AuditPage({ searchParams }: PageProps<"/espace/journal">) {
  const user = await requirePermission("audit:view");
  const sp = await searchParams;
  const filters = auditFilters(sp);
  const page = listParams(sp, 25);
  const [{ rows, total }, options] = await Promise.all([listAudit(user, filters, page), auditFilterOptions(user)]);

  const columns: Column<Row>[] = [
    { header: "Date", cell: (r) => <span className="whitespace-nowrap tabular-nums">{formatDateTime(r.createdAt)}</span> },
    {
      header: "Utilisateur",
      cell: (r) =>
        r.user ? (
          <div>
            <p className="font-semibold">
              {r.user.firstName} {r.user.lastName}
            </p>
            <p className="text-xs text-muted">{r.user.role.name}</p>
          </div>
        ) : (
          <span className="text-muted">Système ou visiteur</span>
        ),
      hideBelow: "sm",
    },
    { header: "Action", cell: (r) => <Badge tone={TONES[r.action] ?? "neutral"}>{actionLabel(r.action)}</Badge> },
    { header: "Ressource", cell: (r) => resourceLabel(r.resource), hideBelow: "md" },
    { header: "Détail", primary: true, cell: (r) => <span className="text-sm max-sm:font-semibold">{r.summary}</span> },
    { header: "Adresse IP", cell: (r) => <span className="text-xs text-muted">{r.ip ?? "–"}</span>, hideBelow: "lg" },
  ];

  const exportQuery = new URLSearchParams();
  for (const k of ["action", "ressource", "utilisateur", "du", "au"]) {
    const v = sp[k];
    if (typeof v === "string" && v) exportQuery.set(k, v);
  }

  const scopeText =
    user.scope.level === "NATIONAL"
      ? "Toute l'activité de la plateforme."
      : user.scope.level === "SCHOOL"
        ? "Activité concernant votre établissement."
        : "Activité concernant les établissements de votre périmètre, et vos propres actions.";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Journal d'activité"
        description={`Chaque action enregistrée : son auteur, sa date et son adresse IP. ${scopeText}`}
        actions={
          can(user, "audit:export") ? (
            <ButtonLink href={`/api/export/journal${exportQuery.size ? `?${exportQuery}` : ""}`} variant="secondary" prefetch={false}>
              <Download aria-hidden /> Exporter en CSV
            </ButtonLink>
          ) : null
        }
      />
      <FilterBar
        basePath="/espace/journal"
        fields={[
          { kind: "select", name: "action", label: "Action", value: filters.action, allLabel: "Toutes", options: options.actions.map((a) => ({ value: a, label: actionLabel(a) })) },
          { kind: "select", name: "ressource", label: "Ressource", value: filters.resource, allLabel: "Toutes", options: options.resources.map((r) => ({ value: r, label: resourceLabel(r) })) },
          { kind: "text", name: "utilisateur", label: "Utilisateur", value: filters.who || null, placeholder: "Nom ou e-mail" },
          { kind: "date", name: "du", label: "Du", value: filters.from },
          { kind: "date", name: "au", label: "Au", value: filters.to },
        ]}
      />
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        total={total}
        page={page.page}
        pageSize={page.pageSize}
        searchParams={sp}
        basePath="/espace/journal"
        searchPlaceholder={false}
        caption="Journal d'activité, du plus récent au plus ancien"
        emptyTitle="Aucune activité"
        emptyDescription="Aucune entrée ne correspond à ces critères dans votre périmètre."
      />
    </div>
  );
}
