import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DataTable, type Column } from "@/components/kit/data-table";
import { PageHeader } from "@/components/kit/page-header";
import { UrlSelect } from "@/components/kit/url-select";
import { buttonVariants } from "@/components/ui/button";
import { requireFeeStaff } from "@/features/fees/access";
import { FeesNav } from "@/features/fees/components/fees-nav";
import { StatusBadge } from "@/features/fees/components/status-badge";
import { feesTabs } from "@/features/fees/nav";
import { getClassOptions, listInvoices } from "@/features/fees/queries";
import { can } from "@/lib/auth/authorize";
import { INVOICE_STATUS_LABELS, INVOICE_STATUSES } from "@/lib/domain/payments";
import { listParams, param } from "@/lib/list";
import { formatDate, formatFcfa } from "@/lib/utils";

export const metadata: Metadata = { title: "Factures" };

type Row = Awaited<ReturnType<typeof listInvoices>>["rows"][number];

export default async function InvoicesPage({ searchParams }: PageProps<"/espace/frais/factures">) {
  const user = await requireFeeStaff("fee:view");
  const sp = await searchParams;
  const { q, page, skip, take, pageSize } = listParams(sp);
  const status = param(sp, "statut");
  const classe = param(sp, "classe");
  const [{ rows, total }, classes] = await Promise.all([listInvoices(user, { q, status, classe, skip, take }), getClassOptions(user)]);

  const exportQs = new URLSearchParams();
  if (q) exportQs.set("q", q);
  if (status) exportQs.set("statut", status);
  if (classe) exportQs.set("classe", classe);

  const columns: Column<Row>[] = [
    {
      header: "Facture",
      cell: (r) => (
        <Link href={`/espace/frais/factures/${r.id}`} className="font-semibold text-primary hover:underline">
          {r.number}
        </Link>
      ),
      mobileHidden: true,
    },
    {
      header: "Élève",
      primary: true,
      cell: (r) => (
        <div>
          {/* On a phone the student heads the card and links to the invoice. */}
          <Link href={`/espace/frais/factures/${r.id}`} className="font-semibold text-primary hover:underline sm:hidden">
            {r.enrollment.student.lastName} {r.enrollment.student.firstName}
          </Link>
          <p className="font-medium max-sm:hidden">
            {r.enrollment.student.lastName} {r.enrollment.student.firstName}
          </p>
          <p className="text-xs text-muted">
            <span className="sm:hidden">{r.number} · </span>
            {r.enrollment.student.matricule}
          </p>
        </div>
      ),
    },
    { header: "Classe", cell: (r) => r.enrollment.classroom.name, hideBelow: "md" },
    { header: "Montant", cell: (r) => formatFcfa(r.totalAmount), className: "text-right tabular-nums", hideBelow: "lg" },
    { header: "Payé", cell: (r) => formatFcfa(r.paidAmount), className: "text-right tabular-nums", hideBelow: "sm" },
    { header: "Reste", cell: (r) => <span className="font-semibold">{formatFcfa(Math.max(0, r.totalAmount - r.paidAmount))}</span>, className: "text-right tabular-nums" },
    { header: "Échéance finale", cell: (r) => formatDate(r.dueDate), hideBelow: "lg" },
    { header: "Statut", cell: (r) => <StatusBadge status={r.effectiveStatus} /> },
  ];

  return (
    <>
      <PageHeader title="Factures" description="Factures de l'année en cours. Les paiements s'enregistrent depuis la facture." />
      <FeesNav items={feesTabs(user)} />
      <DataTable
        caption="Liste des factures"
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        total={total}
        page={page}
        pageSize={pageSize}
        searchParams={sp}
        basePath="/espace/frais/factures"
        searchPlaceholder="Rechercher un élève, un matricule, un numéro…"
        emptyTitle="Aucune facture ne correspond"
        emptyDescription="Modifiez la recherche ou les filtres."
        toolbar={
          <>
            <UrlSelect
              param="statut"
              label="Filtrer par statut"
              hideLabel
              replace
              allLabel="Tous les statuts"
              options={INVOICE_STATUSES.map((s) => ({ value: s, label: INVOICE_STATUS_LABELS[s] }))}
              className="sm:w-48"
            />
            <UrlSelect
              param="classe"
              label="Filtrer par classe"
              hideLabel
              replace
              allLabel="Toutes les classes"
              options={classes.map((c) => ({ value: c.id, label: c.name }))}
              className="sm:w-48"
            />
            {can(user, "fee:export") && (
              <a href={`/api/export/factures${exportQs.size ? `?${exportQs}` : ""}`} className={buttonVariants({ variant: "secondary" })} download>
                <Download aria-hidden /> Exporter en CSV
              </a>
            )}
          </>
        }
      />
    </>
  );
}
