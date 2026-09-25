import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { PrintButton, PrintStyles } from "@/features/fees/components/print";
import { getReceipt } from "@/features/payments/queries";
import { requirePermission } from "@/lib/auth/authorize";
import { amountInWords, PAYMENT_METHOD_LABELS } from "@/lib/domain/payments";
import { formatDate, formatFcfa } from "@/lib/utils";

export const metadata: Metadata = { title: "Reçu de paiement" };

export default async function ReceiptPage({ params }: PageProps<"/espace/frais/paiements/[id]/recu">) {
  const user = await requirePermission("payment:view");
  const { id } = await params;
  const payment = await getReceipt(user, id);
  if (!payment) notFound();

  const { invoice } = payment;
  const student = invoice.enrollment.student;
  const words = amountInWords(payment.amount);
  const rest = Math.max(0, invoice.totalAmount - invoice.paidAmount);

  return (
    <>
      <PrintStyles />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/espace/frais/factures/${invoice.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Retour à la facture {invoice.number}
        </Link>
        <PrintButton label="Imprimer le reçu" />
      </div>

      <article className="mx-auto max-w-2xl rounded-card border border-border bg-surface p-6 text-text sm:p-8 print:border-0 print:p-0" aria-labelledby="receipt-title">
        <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Logo />
            <p className="mt-3 font-semibold">{invoice.school.name}</p>
            {invoice.school.address && <p className="text-sm text-muted">{invoice.school.address}</p>}
            {invoice.school.phone && <p className="text-sm text-muted">Tél. {invoice.school.phone}</p>}
          </div>
          <div className="sm:text-right">
            <h1 id="receipt-title" className="text-2xl font-bold">
              Reçu de paiement
            </h1>
            <p className="mt-1 font-mono text-lg font-semibold">{payment.reference}</p>
            <p className="text-sm text-muted">du {formatDate(payment.paidAt)}</p>
          </div>
        </header>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 py-5 sm:grid-cols-2">
          <Item label="Élève" value={`${student.lastName} ${student.firstName}`} />
          <Item label="Matricule" value={student.matricule} />
          <Item label="Classe" value={`${invoice.enrollment.classroom.name}, année ${invoice.enrollment.academicYear.label}`} />
          <Item label="Facture" value={invoice.number} />
          <Item label="Objet" value={invoice.items.map((i) => i.description).join(", ")} />
          <Item label="Mode de paiement" value={`${PAYMENT_METHOD_LABELS[payment.method]}${payment.transactionId ? `, réf. ${payment.transactionId}` : ""}`} />
        </dl>

        <div className="rounded-lg bg-primary-soft px-5 py-4">
          <p className="text-sm font-semibold text-primary">Montant reçu</p>
          <p className="font-display text-3xl font-bold">{formatFcfa(payment.amount)}</p>
          <p className="mt-1 text-sm">
            Arrêté le présent reçu à la somme de <strong>{words} francs CFA</strong>.
          </p>
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <Item label="Total de la facture" value={formatFcfa(invoice.totalAmount)} />
          <Item label="Total payé à ce jour" value={formatFcfa(invoice.paidAmount)} />
          <Item label="Reste à payer" value={rest > 0 ? formatFcfa(rest) : "Facture soldée"} />
        </dl>

        <footer className="mt-8 flex flex-col gap-6 border-t border-border pt-5 text-sm sm:flex-row sm:justify-between">
          <p className="text-muted">
            Encaissé par {payment.recordedBy.firstName} {payment.recordedBy.lastName}
            <br />
            Enregistré le {formatDate(payment.createdAt)}
          </p>
          <div className="sm:text-right">
            <p className="text-muted">Cachet et signature</p>
            <div className="mt-2 h-16 w-48 rounded border border-dashed border-border-strong sm:ml-auto" aria-hidden />
          </div>
        </footer>
      </article>
    </>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
