import type { Metadata } from "next";
import Link from "next/link";

import { DataTable, type Column } from "@/components/kit/data-table";
import { PageHeader } from "@/components/kit/page-header";
import { UrlSelect } from "@/components/kit/url-select";
import { Badge } from "@/components/ui/badge";
import { StudentAvatar } from "@/features/students/components/student-avatar";
import { TransfersOff } from "@/features/transfers/components/module-off";
import { TransferStatusBadge } from "@/features/transfers/components/transfer-timeline";
import { KIND_LABELS, STATUS_LABELS, type TransferStatusCode } from "@/features/transfers/logic";
import { listTransfers, pendingCounts, type TransferDirection } from "@/features/transfers/queries";
import { requirePermission } from "@/lib/auth/authorize";
import { isEnabled } from "@/lib/features";
import { listParams, param } from "@/lib/list";
import { cn, formatDate, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Transferts" };

type Row = Awaited<ReturnType<typeof listTransfers>>["rows"][number];

const STATUSES = ["PENDING", "PENDING_GUARDIAN", "PENDING_DESTINATION", "ACCEPTED", "REJECTED", "CANCELLED", "ALL"] as const;
const KINDS = ["ALL", "SCHOOL_CHANGE", "CLASS_CHANGE"] as const;

export default async function TransfersPage(props: PageProps<"/espace/transferts">) {
  const user = await requirePermission(["student:view", "report_card:view"]);
  if (!(await isEnabled("students.transfers"))) {
    return (
      <>
        <PageHeader title="Transferts" readable={false} />
        <TransfersOff />
      </>
    );
  }
  const sp = await props.searchParams;
  const { q, page, pageSize, skip, take } = listParams(sp);
  const isSchool = user.scope.level === "SCHOOL";
  const direction: TransferDirection = isSchool ? (param(sp, "sens") === "sortants" ? "outgoing" : "incoming") : "all";
  const status = STATUSES.find((s) => s === param(sp, "statut")) ?? "ALL";
  const kind = KINDS.find((k) => k === param(sp, "type")) ?? "ALL";
  const [{ rows, total }, counts] = await Promise.all([listTransfers(user, { direction, status, kind, q, skip, take }), pendingCounts(user)]);

  const description = isSchool
    ? "Élèves qui arrivent dans votre établissement et élèves qui en partent. Chaque transfert garde son historique."
    : user.scope.level === "SELF"
      ? "Changements de classe et d'établissement de vos enfants."
      : "Transferts des établissements de votre territoire, en lecture seule.";

  const columns: Column<Row>[] = [
    {
      header: "Élève",
      primary: true,
      cell: (r) => {
        const name = `${r.student.lastName} ${r.student.firstName}`;
        return (
          <div className="flex items-center gap-3">
            <StudentAvatar name={`${r.student.firstName} ${r.student.lastName}`} photoFileId={r.student.photoFileId} />
            <div className="min-w-0">
              <Link href={`/espace/transferts/${r.id}`} className="font-semibold text-primary hover:underline">
                {name}
              </Link>
              <span className="block font-mono text-xs text-muted">{r.student.matricule}</span>
            </div>
          </div>
        );
      },
    },
    { header: "Type", cell: (r) => KIND_LABELS[r.kind], hideBelow: "md" },
    {
      header: "Départ",
      cell: (r) => (
        <span>
          {r.fromSchool.name}
          <span className="block text-xs text-muted">{r.fromClassroom ?? r.fromSchool.commune.name}</span>
        </span>
      ),
      hideBelow: "sm",
    },
    {
      header: "Arrivée",
      cell: (r) => (
        <span>
          {r.kind === "CLASS_CHANGE" ? (r.toClassroom ?? "–") : r.toSchool.name}
          <span className="block text-xs text-muted">{r.kind === "CLASS_CHANGE" ? "Même établissement" : (r.toClassroom ?? r.toSchool.commune.name)}</span>
        </span>
      ),
    },
    { header: "Demandé le", cell: (r) => <span className="whitespace-nowrap tabular-nums">{formatDate(r.createdAt)}</span>, hideBelow: "lg" },
    { header: "Statut", cell: (r) => <TransferStatusBadge status={r.status as TransferStatusCode} /> },
  ];

  const tabs = [
    { value: "entrants", label: "Entrants", count: counts.incoming, current: direction === "incoming" },
    { value: "sortants", label: "Sortants", count: counts.outgoing, current: direction === "outgoing" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Transferts" info={description} />
      {isSchool && (
        <nav aria-label="Sens des transferts" className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            const qs = new URLSearchParams();
            qs.set("sens", t.value);
            if (status !== "ALL") qs.set("statut", status);
            return (
              <Link
                key={t.value}
                href={`/espace/transferts?${qs}`}
                aria-current={t.current ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap",
                  t.current ? "border-primary bg-primary text-on-primary" : "border-border-strong bg-surface hover:bg-surface-2",
                )}
              >
                {t.label}
                {t.count > 0 && (
                  <span className="tabular-nums">
                    ({formatNumber(t.count)} en attente)
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      )}
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        total={total}
        page={page}
        pageSize={pageSize}
        searchParams={sp}
        basePath="/espace/transferts"
        searchPlaceholder="Élève, matricule ou établissement"
        toolbar={
          <>
            <UrlSelect
              param="statut"
              label="Statut"
              hideLabel
              value={status === "ALL" ? "" : status}
              allLabel="Tous les statuts"
              options={STATUSES.filter((s) => s !== "ALL").map((s) => ({ value: s, label: s === "PENDING" ? "En attente (toutes)" : STATUS_LABELS[s] }))}
              className="sm:w-56"
            />
            {direction !== "incoming" && (
              <UrlSelect
                param="type"
                label="Type"
                hideLabel
                value={kind === "ALL" ? "" : kind}
                allLabel="Tous les types"
                options={[
                  { value: "SCHOOL_CHANGE", label: KIND_LABELS.SCHOOL_CHANGE },
                  { value: "CLASS_CHANGE", label: KIND_LABELS.CLASS_CHANGE },
                ]}
                className="sm:w-56"
              />
            )}
          </>
        }
        caption={direction === "incoming" ? "Transferts entrants" : direction === "outgoing" ? "Transferts sortants" : "Transferts"}
        emptyTitle={direction === "incoming" ? "Aucun élève en arrivée" : direction === "outgoing" ? "Aucun transfert sortant" : "Aucun transfert"}
        emptyDescription={
          isSchool && direction === "outgoing" ? "Pour transférer un élève, ouvrez sa fiche puis choisissez « Transférer »." : isSchool ? "Les demandes d'accueil d'autres établissements s'afficheront ici." : undefined
        }
      />
      {!isSchool && user.scope.level !== "SELF" && total > 0 && (
        <p className="text-sm text-muted">
          <Badge tone="info">Lecture seule</Badge> Les décisions appartiennent à la famille et aux établissements concernés.
        </p>
      )}
    </div>
  );
}
