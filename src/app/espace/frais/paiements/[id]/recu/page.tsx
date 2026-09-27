import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintButton } from "@/components/kit/print-button";
import { requirePermission } from "@/lib/auth/authorize";
import { PAYMENT_METHOD_LABELS } from "@/lib/domain/payments";
import { loadReceipt } from "@/lib/pdf/data/payments";
import { PdfDownloadLink } from "@/lib/pdf/download-link";
import { amountSentence, beninDate, officialName, pdfFcfa } from "@/lib/pdf/format";
import { PrintInfoGrid, PrintSheet, PrintSignatures } from "@/lib/pdf/print/sheet";

export const metadata: Metadata = { title: "Reçu de paiement" };

// The receipt as printed from the browser, laid out like its PDF. The lookup
// goes through paymentWhere(): a payment outside the user's scope is not
// found, whatever identifier is typed in the address bar.
export default async function ReceiptPage({ params }: PageProps<"/espace/frais/paiements/[id]/recu">) {
  const user = await requirePermission("payment:view");
  const { id } = await params;
  const receipt = await loadReceipt(user, id);
  if (!receipt) notFound();

  const { data, issuer, invoiceId } = receipt;
  const rest = Math.max(0, data.invoice.totalAmount - data.invoice.paidAmount);
  const meta = {
    title: "Reçu de paiement",
    subtitle: `Facture ${data.invoice.number}`,
    reference: data.reference,
    generatedAt: new Date(),
    generatedBy: { name: user.fullName, role: user.role.name, email: user.username },
    issuer,
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3" data-print-hide>
        <Link href={`/espace/frais/factures/${invoiceId}`} className="inline-flex items-center max-lg:hidden gap-1.5 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Retour à la facture {data.invoice.number}
        </Link>
        <div className="flex flex-wrap gap-2">
          <PrintButton label="Imprimer le reçu" />
          <PdfDownloadLink href={`/api/pdf/recu/${receipt.id}`} description={`reçu ${data.reference}`} />
        </div>
      </div>

      <PrintSheet meta={meta}>
        <PrintInfoGrid
          columns={3}
          items={[
            { label: "Élève", value: officialName(data.student.lastName, data.student.firstName) },
            { label: "Matricule", value: data.student.matricule },
            { label: "Classe", value: `${data.classroom}, ${data.yearLabel}` },
            { label: "Facture", value: data.invoice.number },
            { label: "Mode de paiement", value: PAYMENT_METHOD_LABELS[data.method] },
            { label: "Transaction", value: data.transactionId ?? "–" },
          ]}
        />

        <div className="doc-amount doc-keep mt-4 px-5 py-4">
          <p className="doc-label">Montant reçu le {beninDate(data.paidAt)}</p>
          <p className="doc-title mt-1 text-4xl">{pdfFcfa(data.amount)}</p>
          <p className="mt-2">
            Arrêté le présent reçu à la somme de <strong>{amountSentence(data.amount)}</strong>.
          </p>
        </div>

        <h2 className="doc-title mt-5 text-base">Objet du paiement</h2>
        <p>{data.invoice.items.map((i) => i.description).join(", ") || "Frais scolaires"}</p>

        <h2 className="doc-title mt-5 text-base">Situation de la facture après ce paiement</h2>
        <div className="doc-keep mt-2 grid gap-3 sm:grid-cols-3 print:grid-cols-3">
          <div className="doc-figure">
            <p className="doc-label">Total de la facture</p>
            <strong className="!text-xl">{pdfFcfa(data.invoice.totalAmount)}</strong>
          </div>
          <div className="doc-figure">
            <p className="doc-label">Total payé à ce jour</p>
            <strong className="!text-xl">{pdfFcfa(data.invoice.paidAmount)}</strong>
          </div>
          <div className="doc-figure doc-primary">
            <p className="doc-label">Reste à payer</p>
            <strong className="!text-xl">{rest > 0 ? pdfFcfa(rest) : "Soldée"}</strong>
          </div>
        </div>

        <div className="doc-keep mt-6 grid gap-6 sm:grid-cols-2 print:grid-cols-2">
          <div className="text-sm">
            <p className="doc-label">Encaissé par</p>
            <p className="font-semibold">{data.recordedBy}</p>
            <p className="doc-muted text-xs">Enregistré le {beninDate(data.createdAt)}</p>
            <p className="doc-muted mt-3 text-xs">Conservez ce reçu : il vous sera demandé en cas de réclamation.</p>
          </div>
          <PrintSignatures className="mt-0" items={[{ role: "Pour l'établissement", stamp: true }]} />
        </div>
      </PrintSheet>
    </>
  );
}
