import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DataTable, type Column } from "@/components/kit/data-table";
import { PageHeader } from "@/components/kit/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { reviewableKinds, staffFilters, staffQueue } from "@/features/family-documents/queries";
import { isHealthDoc, KIND_LABELS, STATUS_LABELS, STATUS_TONES, type FamilyDocKind, type FamilyDocStatus } from "@/features/family-documents/rules";
import { can, requirePermission } from "@/lib/auth/authorize";
import { listParams } from "@/lib/list";
import { cn, formatDate, formatDateTime, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Pièces des familles" };

type Row = Awaited<ReturnType<typeof staffQueue>>["rows"][number];

const KIND_TABS: Record<FamilyDocKind, string> = { ENROLLMENT: "Inscription", ABSENCE: "Absences", MEDICAL: "Certificats médicaux" };

function what(r: Row) {
  if (r.kind === "ENROLLMENT") return r.requiredPiece?.label ?? KIND_LABELS.ENROLLMENT;
  if (r.kind === "ABSENCE") return r.attendance ? `Absence du ${formatDate(r.attendance.date)} ${r.attendance.half === "MORNING" ? "matin" : "après-midi"}` : KIND_LABELS.ABSENCE;
  return r.startsOn && r.endsOn ? `Dispense d'EPS du ${formatDate(r.startsOn)} au ${formatDate(r.endsOn)}` : KIND_LABELS.MEDICAL;
}

export default async function FamilyPiecesQueuePage({ searchParams }: PageProps<"/espace/pieces-familles">) {
  const user = await requirePermission(["family_document:approve", "health_document:approve"]);
  const sp = await searchParams;
  const filters = staffFilters(sp);
  const page = listParams(sp);
  const { rows, total, pendingByKind } = await staffQueue(user, filters, page);
  const kinds = reviewableKinds(user);
  const pendingTotal = kinds.reduce((n, k) => n + pendingByKind[k], 0);

  const href = (next: { type?: FamilyDocKind | null; statut?: FamilyDocStatus | "tous" }) => {
    const q = new URLSearchParams();
    const type = next.type === undefined ? filters.kind : next.type;
    const statut = next.statut ?? (filters.status ?? "tous");
    if (type) q.set("type", type);
    if (statut !== "PENDING") q.set("statut", statut);
    const s = q.toString();
    return s ? `/espace/pieces-familles?${s}` : "/espace/pieces-familles";
  };

  const columns: Column<Row>[] = [
    {
      header: "Élève",
      primary: true,
      cell: (r) => (
        <div>
          <Link href={`/espace/pieces-familles/${r.id}`} className="font-semibold text-primary hover:underline">
            {r.student.firstName} {r.student.lastName}
          </Link>
          <p className="text-xs text-muted">{r.enrollment.classroom.name}</p>
        </div>
      ),
    },
    {
      header: "Pièce",
      cell: (r) => (
        <div>
          <p>{what(r)}</p>
          <p className="text-xs text-muted">
            {KIND_LABELS[r.kind]}
            {isHealthDoc(r) && r.kind !== "MEDICAL" ? ", pièce de santé" : ""}
          </p>
        </div>
      ),
    },
    { header: "Envoyée", cell: (r) => formatDateTime(r.createdAt), hideBelow: "md" },
    { header: "Statut", cell: (r) => <Badge tone={STATUS_TONES[r.status]}>{STATUS_LABELS[r.status]}</Badge> },
  ];

  const kindTabs = [{ value: null, label: "Tout", count: pendingTotal }, ...kinds.map((k) => ({ value: k, label: KIND_TABS[k], count: pendingByKind[k] }))];
  const statusTabs: { value: FamilyDocStatus | "tous"; label: string }[] = [
    { value: "PENDING", label: "À examiner" },
    { value: "ACCEPTED", label: "Validées" },
    { value: "REJECTED", label: "Refusées" },
    { value: "tous", label: "Toutes" },
  ];
  const tab = (on: boolean) => cn("inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 text-sm font-semibold whitespace-nowrap sm:min-h-9", on ? "border-primary bg-primary text-on-primary" : "border-border-strong hover:bg-surface-2");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Pièces des familles"
        description={pendingTotal ? `${formatNumber(pendingTotal)} pièce${pendingTotal > 1 ? "s" : ""} à examiner.` : "Aucune pièce en attente. Les envois des parents arrivent ici."}
        actions={
          can(user, "family_document:approve") ? (
            <ButtonLink href="/espace/pieces-familles/liste" variant="secondary">
              <ListChecks aria-hidden /> Pièces demandées à l&apos;inscription
            </ButtonLink>
          ) : null
        }
      />
      <nav aria-label="Filtrer par type de pièce" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {kindTabs.map((t) => (
          <Link key={t.label} href={href({ type: t.value })} aria-current={filters.kind === t.value ? "page" : undefined} className={tab(filters.kind === t.value)}>
            {t.label}
            {t.count > 0 && <span className="ml-1 tabular-nums opacity-80">({formatNumber(t.count)} en attente)</span>}
          </Link>
        ))}
      </nav>
      <nav aria-label="Filtrer par statut" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {statusTabs.map((t) => {
          const on = (filters.status ?? "tous") === t.value;
          return (
            <Link key={t.value} href={href({ statut: t.value })} aria-current={on ? "page" : undefined} className={tab(on)}>
              {t.label}
            </Link>
          );
        })}
      </nav>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        total={total}
        page={page.page}
        pageSize={page.pageSize}
        searchParams={sp}
        basePath="/espace/pieces-familles"
        searchPlaceholder="Rechercher un élève par nom ou matricule…"
        caption="Pièces envoyées par les familles"
        emptyTitle={filters.status === "PENDING" ? "Rien à examiner" : "Aucune pièce"}
        emptyDescription={filters.status === "PENDING" ? "Toutes les pièces reçues ont une réponse." : "Aucune pièce ne correspond à ce filtre."}
      />
    </div>
  );
}
