import { ArrowLeft, Receipt, Undo2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/kit/page-header";
import { EmptyState } from "@/components/kit/states";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { startOfToday } from "@/features/fees/access";
import { StatusBadge } from "@/features/fees/components/status-badge";
import { getInvoice } from "@/features/fees/queries";
import { CancelPaymentButton } from "@/features/payments/components/cancel-payment-button";
import { PaymentForm } from "@/features/payments/components/payment-form";
import { can, requirePermission } from "@/lib/auth/authorize";
import { installmentStatus, PAYMENT_METHOD_LABELS, type InvoiceStatusCode } from "@/lib/domain/payments";
import { formatDate, formatFcfa } from "@/lib/utils";

export const metadata: Metadata = { title: "Facture" };

export default async function InvoicePage({ params }: PageProps<"/espace/frais/factures/[id]">) {
  const user = await requirePermission("fee:view");
  const { id } = await params;
  // Scoped lookup: an invoice outside the user's scope is reported as not
  // found, whatever identifier is typed in the address bar.
  const invoice = await getInvoice(user, id);
  if (!invoice) notFound();

  const student = invoice.enrollment.student;
  const remaining = Math.max(0, invoice.totalAmount - invoice.paidAmount);
  const canPay = can(user, "payment:create") && remaining > 0 && invoice.status !== "CANCELLED";
  const canCancel = can(user, "payment:delete") && invoice.status !== "CANCELLED";
  const progress = invoice.totalAmount > 0 ? Math.round((invoice.paidAmount / invoice.totalAmount) * 100) : 0;

  return (
    <>
      <Link href="/espace/frais/factures" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline print:hidden">
        <ArrowLeft className="size-4" aria-hidden /> Toutes les factures
      </Link>
      <PageHeader
        title={`Facture ${invoice.number}`}
        description={`${student.lastName} ${student.firstName} · ${invoice.enrollment.classroom.name} · Année ${invoice.enrollment.academicYear.label}`}
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Situation</CardTitle>
              <StatusBadge status={invoice.effectiveStatus} />
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              <dl className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-3">
                <div>
                  <dt className="text-sm text-muted">Montant total</dt>
                  <dd className="text-xl font-bold tabular-nums">{formatFcfa(invoice.totalAmount)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">Déjà payé</dt>
                  <dd className="text-xl font-bold tabular-nums text-success">{formatFcfa(invoice.paidAmount)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">Reste à payer</dt>
                  <dd className="text-xl font-bold tabular-nums">{formatFcfa(remaining)}</dd>
                </div>
              </dl>
              <div>
                <div
                  className="h-3 rounded-full bg-surface-2"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                  aria-label="Part payée de la facture"
                >
                  <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted">{progress} % payé · émise le {formatDate(invoice.issueDate)} · matricule {student.matricule}</p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tranches</CardTitle>
            </CardHeader>
            <Table>
              <caption className="sr-only">Tranches de la facture, dans l&apos;ordre des échéances</caption>
              <THead>
                <tr>
                  <TH>Tranche</TH>
                  <TH>Échéance</TH>
                  <TH className="text-right">Montant</TH>
                  <TH className="text-right max-sm:hidden">Payé</TH>
                  <TH>Statut</TH>
                </tr>
              </THead>
              <tbody>
                {invoice.installments.map((i) => (
                  <TR key={i.id}>
                    <TD className="font-medium">{i.label}</TD>
                    <TD>{formatDate(i.dueDate)}</TD>
                    <TD className="text-right tabular-nums">{formatFcfa(i.amount)}</TD>
                    <TD className="text-right tabular-nums max-sm:hidden">{formatFcfa(i.paidAmount)}</TD>
                    <TD>
                      <StatusBadge kind="installment" status={installmentDisplay(i, invoice.status)} />
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Détail</CardTitle>
            </CardHeader>
            <Table>
              <caption className="sr-only">Lignes de la facture</caption>
              <THead>
                <tr>
                  <TH>Désignation</TH>
                  <TH className="text-right">Quantité</TH>
                  <TH className="text-right">Prix unitaire</TH>
                  <TH className="text-right">Total</TH>
                </tr>
              </THead>
              <tbody>
                {invoice.items.map((item) => (
                  <TR key={item.id}>
                    <TD>{item.description}</TD>
                    <TD className="text-right tabular-nums">{item.quantity}</TD>
                    <TD className="text-right tabular-nums">{formatFcfa(item.unitPrice)}</TD>
                    <TD className="text-right font-semibold tabular-nums">{formatFcfa(item.unitPrice * item.quantity)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historique des paiements</CardTitle>
            </CardHeader>
            {invoice.payments.length === 0 ? (
              <EmptyState title="Aucun paiement pour le moment" description="Les versements enregistrés apparaîtront ici, avec leur reçu." />
            ) : (
              <ul className="divide-y divide-border">
                {invoice.payments.map((p) => (
                  <li key={p.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {formatFcfa(p.amount)} <span className="font-normal text-muted">· {PAYMENT_METHOD_LABELS[p.method]}</span>
                      </p>
                      <p className="text-xs text-muted">
                        {p.reference} · {formatDate(p.paidAt)}
                        {p.transactionId ? ` · transaction ${p.transactionId}` : ""} · saisi par {p.recordedBy.firstName} {p.recordedBy.lastName}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <ButtonLink href={`/espace/frais/paiements/${p.id}/recu`} variant="secondary" size="sm">
                        <Receipt aria-hidden /> Reçu
                      </ButtonLink>
                      {canCancel && <CancelPaymentButton id={p.id} reference={p.reference} amount={p.amount} />}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="flex flex-col gap-6" aria-label="Encaissement">
          {canPay ? (
            <Card>
              <CardHeader>
                <CardTitle>Enregistrer un paiement</CardTitle>
              </CardHeader>
              <CardBody>
                <PaymentForm invoiceId={invoice.id} remaining={remaining} today={startOfToday().toISOString().slice(0, 10)} />
              </CardBody>
            </Card>
          ) : remaining === 0 ? (
            <Alert tone="success" title="Facture soldée">
              Tous les versements attendus ont été reçus.
            </Alert>
          ) : invoice.status === "CANCELLED" ? (
            <Alert tone="warning" title="Facture annulée">
              Elle ne peut plus recevoir de paiement.
            </Alert>
          ) : null}
          {canCancel && invoice.payments.length > 0 && (
            <p className="flex gap-2 text-sm text-muted">
              <Undo2 className="mt-0.5 size-4 shrink-0" aria-hidden />
              Annuler un paiement le retire et redistribue les montants restants sur les tranches. L&apos;annulation est inscrite au journal
              d&apos;activité.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}

function installmentDisplay(i: { amount: number; paidAmount: number; dueDate: Date }, invoiceStatus: string): InvoiceStatusCode {
  return invoiceStatus === "CANCELLED" ? "CANCELLED" : installmentStatus(i.amount, i.paidAmount, i.dueDate, startOfToday());
}
