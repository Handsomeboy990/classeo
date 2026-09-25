import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DataTable, type Column } from "@/components/kit/data-table";
import { PageHeader } from "@/components/kit/page-header";
import { ButtonLink } from "@/components/ui/button";
import { SchoolStatusBadge } from "@/features/school-status/components/status-badge";
import { SchoolStatusDialog } from "@/features/school-status/components/status-dialog";
import { SCHOOL_STATUS_LABELS, SCHOOL_STATUSES } from "@/features/school-status/labels";
import { SchoolFormDialog } from "@/features/schools/components/school-form-dialog";
import { CYCLE_LABELS, CYCLES, SECTOR_LABELS, SECTORS } from "@/features/schools/labels";
import { communeOptions, listSchools, schoolFilters } from "@/features/schools/queries";
import { FilterBar, type FilterField } from "@/features/territory/components/filter-bar";
import { listDepartments } from "@/features/territory/queries";
import { can, requirePermission } from "@/lib/auth/authorize";
import { listParams } from "@/lib/list";

export const metadata: Metadata = { title: "Établissements" };

type Row = Awaited<ReturnType<typeof listSchools>>["rows"][number];

export default async function SchoolsPage({ searchParams }: PageProps<"/espace/etablissements">) {
  const user = await requirePermission("school:view");
  const sp = await searchParams;
  const filters = schoolFilters(sp);
  const page = listParams(sp);
  const level = user.scope.level;

  const [{ rows, total }, communes, departments] = await Promise.all([
    listSchools(user, filters, page),
    communeOptions(user),
    level === "NATIONAL" ? listDepartments() : Promise.resolve([]),
  ]);

  const canToggle = can(user, "school:lock") && level !== "SCHOOL" && level !== "SELF";
  const columns: Column<Row>[] = [
    {
      header: "Établissement",
      primary: true,
      cell: (s) => (
        <div>
          <Link href={`/espace/etablissements/${s.id}`} className="font-semibold text-primary hover:underline">
            {s.name}
          </Link>
          <p className="text-xs text-muted">{s.code}</p>
        </div>
      ),
    },
    { header: "Commune", cell: (s) => `${s.commune.name} (${s.commune.department.name})`, hideBelow: "md" },
    { header: "Secteur", cell: (s) => SECTOR_LABELS[s.sector], hideBelow: "lg", mobileHidden: false },
    { header: "Cycle", cell: (s) => CYCLE_LABELS[s.cycle], hideBelow: "sm" },
    {
      header: "Statut",
      cell: (s) => (
        <div className="flex flex-col items-start gap-1">
          <SchoolStatusBadge status={s.status} reason={s.statusReason} />
          {s.status !== "ACTIVE" && s.statusReason && <span className="line-clamp-2 max-w-64 text-xs text-muted">{s.statusReason}</span>}
        </div>
      ),
    },
    ...(canToggle ? [{ header: "Actions", actions: true, cell: (s: Row) => <SchoolStatusDialog id={s.id} name={s.name} status={s.status} size="sm" />, className: "text-right" }] : []),
  ];

  const communeChoices = communes.filter((c) => !filters.departmentId || c.department.id === filters.departmentId);
  const fields: FilterField[] = [
    ...(level === "NATIONAL"
      ? [{ kind: "select" as const, name: "departement", label: "Département", value: filters.departmentId, allLabel: "Tous", options: departments.map((d) => ({ value: d.id, label: d.name })) }]
      : []),
    ...(communes.length > 1
      ? [
          {
            kind: "select" as const,
            name: "commune",
            label: "Commune",
            value: filters.communeId,
            allLabel: "Toutes",
            options: communeChoices.map((c) => ({ value: c.id, label: c.name, group: level === "NATIONAL" && !filters.departmentId ? c.department.name : undefined })),
          },
        ]
      : []),
    { kind: "select", name: "secteur", label: "Secteur", value: filters.sector, allLabel: "Tous", options: SECTORS.map((s) => ({ value: s, label: SECTOR_LABELS[s] })) },
    { kind: "select", name: "cycle", label: "Cycle", value: filters.cycle, allLabel: "Tous", options: CYCLES.map((c) => ({ value: c, label: CYCLE_LABELS[c] })) },
    {
      kind: "select",
      name: "statut",
      label: "Statut",
      value: filters.status,
      allLabel: "Tous",
      options: SCHOOL_STATUSES.map((st) => ({ value: st, label: SCHOOL_STATUS_LABELS[st] })),
    },
  ];

  const exportQuery = new URLSearchParams();
  for (const k of ["q", "departement", "commune", "secteur", "cycle", "statut"]) {
    const v = sp[k];
    if (typeof v === "string" && v) exportQuery.set(k, v);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Établissements"
        description={`Écoles, collèges et lycées de votre périmètre : ${user.scope.label}.`}
        actions={
          <>
            {can(user, "school:export") && (
              <ButtonLink href={`/api/export/etablissements${exportQuery.size ? `?${exportQuery}` : ""}`} variant="secondary" prefetch={false}>
                <Download aria-hidden /> Exporter en CSV
              </ButtonLink>
            )}
            {can(user, "school:create") && level !== "SCHOOL" && <SchoolFormDialog communes={communes} />}
          </>
        }
      />
      <FilterBar fields={fields} basePath="/espace/etablissements" keep={{ q: filters.q }} />
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(s) => s.id}
        total={total}
        page={page.page}
        pageSize={page.pageSize}
        searchParams={sp}
        basePath="/espace/etablissements"
        searchPlaceholder="Rechercher par nom ou code…"
        caption="Liste des établissements de votre périmètre"
        emptyTitle="Aucun établissement"
        emptyDescription="Aucun établissement ne correspond à ces critères dans votre périmètre."
      />
    </div>
  );
}
