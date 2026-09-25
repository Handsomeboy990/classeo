import { Download, Receipt } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DataTable, type Column } from "@/components/kit/data-table";
import { PageHeader } from "@/components/kit/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireFeeStaff } from "@/features/fees/access";
import { FeesNav } from "@/features/fees/components/fees-nav";
import { FilterSelect } from "@/features/fees/components/filter-select";
import { feesTabs } from "@/features/fees/nav";
import { listPayments } from "@/features/payments/queries";
import { can } from "@/lib/auth/authorize";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/lib/domain/payments";
import { listParams, param } from "@/lib/list";
import { formatDate, formatFcfa } from "@/lib/utils";

export const metadata: Metadata = { title: "Paiements" };

type Row = Awaited<ReturnType<typeof listPayments>>["rows"][number];

export default async function PaymentsPage({ searchParams }: PageProps<"/espace/frais/paiements">) {
  const user = await requireFeeStaff("payment:view");
  const sp = await searchParams;
  const { q, page, skip, take, pageSize } = listParams(sp);
  const method = param(sp, "mode");
  const { rows, total, sum } = await listPayments(user, { q, method, skip, take });

  const exportQs = new URLSearchParams();
  if (q) exportQs.set("q", q);
  if (method) exportQs.set("mode", method);

  const columns: Column<Row>[] = [
    { header: "Référence", cell: (r) => <span className="font-semibold">{r.reference}</span> },
    { header: "Date", cell: (r) => formatDate(r.paidAt), hideBelow: "sm" },
    {
      header: "Élève",
      cell: (r) => (
        <Link href={`/espace/frais/factures/${r.invoice.id}`} className="font-medium text-primary hover:underline">
          {r.invoice.enrollment.student.lastName} {r.invoice.enrollment.student.firstName}
        </Link>
      ),
    },
    { header: "Classe", cell: (r) => r.invoice.enrollment.classroom.name, hideBelow: "lg" },
    { header: "Facture", cell: (r) => r.invoice.number, hideBelow: "lg" },
    { header: "Mode", cell: (r) => PAYMENT_METHOD_LABELS[r.method], hideBelow: "md" },
    { header: "Montant", cell: (r) => <span className="font-semibold">{formatFcfa(r.amount)}</span>, className: "text-right tabular-nums" },
    {
      header: "Reçu",
      cell: (r) => (
        <Link href={`/espace/frais/paiements/${r.id}/recu`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          <Receipt className="size-4" aria-hidden />
          <span className="max-sm:sr-only">Reçu</span>
          <span className="sr-only"> du paiement {r.reference}</span>
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Paiements" description={`Versements enregistrés sur l'année en cours. Total de la sélection : ${formatFcfa(sum)}.`} />
      <FeesNav items={feesTabs(user)} />
      <DataTable
        caption="Liste des paiements"
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        total={total}
        page={page}
        pageSize={pageSize}
        searchParams={sp}
        basePath="/espace/frais/paiements"
        searchPlaceholder="Rechercher une référence, un élève, une facture…"
        emptyTitle="Aucun paiement ne correspond"
        toolbar={
          <>
            <FilterSelect param="mode" label="Filtrer par mode de paiement" allLabel="Tous les modes" options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))} />
            {can(user, "payment:export") && (
              <a href={`/api/export/paiements${exportQs.size ? `?${exportQs}` : ""}`} className={buttonVariants({ variant: "secondary" })} download>
                <Download aria-hidden /> Exporter en CSV
              </a>
            )}
          </>
        }
      />
    </>
  );
}
