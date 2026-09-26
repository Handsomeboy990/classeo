import { ArrowLeft, Building2, CheckCircle2, Clock, Info, Landmark, ReceiptText, Smartphone, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InfoTip } from "@/components/kit/info-tip";
import { PageHeader } from "@/components/kit/page-header";
import { EmptyState } from "@/components/kit/states";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/features/fees/components/status-badge";
import { DeclarationForm } from "@/features/online-payment/components/declaration-form";
import { PayOnlineForm } from "@/features/online-payment/components/pay-online-form";
import { onlinePaymentsOf, payableInvoice } from "@/features/online-payment/queries";
import { unpaidInOrder } from "@/features/online-payment/rules";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PAYMENT_METHOD_LABELS, type InvoiceStatusCode } from "@/lib/domain/payments";
import { isEnabled } from "@/lib/features";
import { fileUrl } from "@/lib/files";
import { onlineProvider } from "@/lib/payments/providers";
import { formatDate, formatFcfa } from "@/lib/utils";

export const metadata: Metadata = { title: "Payer une facture" };

const DECLARATION = {
  PENDING: { tone: "warning", Icon: Clock, label: "En vérification" },
  CONFIRMED: { tone: "success", Icon: CheckCircle2, label: "Confirmé" },
  REJECTED: { tone: "danger", Icon: XCircle, label: "Non retrouvé" },
} as const;

const ONLINE = {
  CREATED: { tone: "neutral", label: "Non commencé" },
  PENDING: { tone: "warning", label: "En attente" },
  APPROVED: { tone: "success", label: "Payé" },
  DECLINED: { tone: "danger", label: "Refusé" },
  CANCELED: { tone: "neutral", label: "Abandonné" },
  REFUNDED: { tone: "neutral", label: "Remboursé" },
} as const;

export default async function PayInvoicePage({ params }: PageProps<"/espace/payer/[invoiceId]">) {
  const user = await requireUser();
  const { invoiceId } = await params;
  const invoice = await payableInvoice(user, invoiceId);
  if (!invoice) notFound();

  const [provider, declarationsOpen, online, guardian] = await Promise.all([
    onlineProvider(),
    isEnabled("payments.declaration"),
    onlinePaymentsOf(user, invoice.id),
    user.guardianId ? db.guardian.findUnique({ where: { id: user.guardianId }, select: { phone: true } }) : null,
  ]);
  const child = invoice.enrollment.student;
  const rest = Math.max(0, invoice.totalAmount - invoice.paidAmount);
  const pendingDeclared = invoice.declarations.filter((d) => d.status === "PENDING").reduce((s, d) => s + d.amount, 0);
  const declarable = Math.max(0, rest - pendingDeclared);
  const unpaid = unpaidInOrder(invoice.installments);
  const accounts = invoice.school.paymentAccounts;
  const payable = rest > 0 && invoice.status !== "CANCELLED";
  const canDeclare = payable && declarationsOpen && accounts.length > 0 && declarable > 0;
  const phone = guardian?.phone ?? "";
  // Amount shortcuts for the declaration: the next installment, the next
  // two, the balance.
  const suggestions = unpaid.slice(0, 2).map((t, i) => ({ label: i === 0 ? t.label : `${unpaid[0]!.label} et ${t.label}`, amount: Math.min(declarable, unpaid.slice(0, i + 1).reduce((s, x) => s + x.remaining, 0)) }));
  if (declarable > 0 && !suggestions.some((s) => s.amount === declarable)) suggestions.push({ label: "Tout le solde", amount: declarable });

  return (
    <>
      <Link href="/espace/payer" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline max-lg:hidden">
        <ArrowLeft className="size-4" aria-hidden /> Toutes les factures
      </Link>
      <PageHeader title={`Frais de ${child.firstName}`} description={`${child.lastName} ${child.firstName} · ${invoice.enrollment.classroom.name} · ${invoice.school.name} · facture ${invoice.number}`} />

      <div className="grid grid-cols-1 gap-6 *:min-w-0 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Situation</CardTitle>
              <StatusBadge status={invoice.status as InvoiceStatusCode} />
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
                <div>
                  <dt className="text-sm text-muted">Total</dt>
                  <dd className="text-xl font-bold tabular-nums">{formatFcfa(invoice.totalAmount)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">Déjà payé</dt>
                  <dd className="text-xl font-bold text-success tabular-nums">{formatFcfa(invoice.paidAmount)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">Reste à payer</dt>
                  <dd className="text-xl font-bold tabular-nums">{formatFcfa(rest)}</dd>
                </div>
              </dl>
              {unpaid.length > 0 && (
                <ol className="flex flex-col gap-2">
                  {unpaid.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-control border border-border px-3 py-2 text-sm">
                      <span className="min-w-28 font-semibold">{t.label}</span>
                      <span className="text-muted">avant le {formatDate(t.dueDate)}</span>
                      <span className="ml-auto font-semibold tabular-nums">{formatFcfa(t.remaining)}</span>
                    </li>
                  ))}
                </ol>
              )}
              {pendingDeclared > 0 && (
                <p className="flex items-center gap-1.5 text-sm text-warning">
                  <Clock className="size-4" aria-hidden /> {formatFcfa(pendingDeclared)} déclaré, en cours de vérification par l&apos;établissement.
                </p>
              )}
            </CardBody>
          </Card>

          {!payable ? (
            <Alert tone="success" title={invoice.status === "CANCELLED" ? "Facture annulée" : "Facture soldée"}>
              {invoice.status === "CANCELLED" ? "Elle ne peut plus recevoir de paiement." : "Tous les versements attendus ont été reçus. Merci."}
            </Alert>
          ) : provider ? (
            <Card>
              <CardHeader>
                <div>
                  <div className="flex items-center gap-1.5">
                    <CardTitle>Payer en ligne</CardTitle>
                    <InfoTip>Mobile Money ou carte bancaire, confirmé automatiquement.</InfoTip>
                  </div>
                </div>
              </CardHeader>
              <CardBody>
                <PayOnlineForm
                  invoiceId={invoice.id}
                  rest={rest}
                  providerLabel="FedaPay"
                  defaultPhone={phone}
                  installments={unpaid.map((t) => ({ id: t.id, label: t.label, remaining: t.remaining, due: formatDate(t.dueDate) }))}
                />
              </CardBody>
            </Card>
          ) : null}

          {payable && accounts.length > 0 && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>{provider ? "Déjà payé autrement ?" : "Payer par Mobile Money ou virement"}</CardTitle>
                  <CardDescription>Envoyez le montant sur un compte de l&apos;école, puis déclarez le paiement ici avec sa référence.</CardDescription>
                </div>
              </CardHeader>
              <CardBody className="flex flex-col gap-5">
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {accounts.map((a) => (
                    <li key={a.id} className="rounded-control border border-border p-3">
                      <p className="flex items-center gap-2 font-semibold">
                        {a.channel === "BANK" ? <Landmark className="size-4 text-primary" aria-hidden /> : <Smartphone className="size-4 text-primary" aria-hidden />}
                        {a.provider}
                      </p>
                      <p className="mt-1 font-mono text-lg font-bold tracking-wide break-all">{a.accountNumber}</p>
                      <p className="text-sm text-muted">Au nom de {a.accountName}</p>
                      {a.instructions && <p className="mt-1 text-sm">{a.instructions}</p>}
                    </li>
                  ))}
                </ul>
                {canDeclare ? (
                  <DeclarationForm invoiceId={invoice.id} max={declarable} accounts={accounts} suggestions={suggestions} defaultPhone={phone} />
                ) : (
                  <p className="text-sm text-muted">
                    {declarationsOpen ? "Le reste à payer est couvert par les paiements en cours de vérification." : "La déclaration de paiement est fermée pour le moment."}
                  </p>
                )}
              </CardBody>
            </Card>
          )}

          {payable && !provider && accounts.length === 0 && (
            <Card>
              <EmptyState
                icon={<Building2 className="size-7" />}
                title="Paiement à l'établissement"
                description={`${invoice.school.name} n'a pas encore ouvert de compte pour le paiement à distance. Réglez au secrétariat ou à la comptabilité${invoice.school.address ? `, ${invoice.school.address}` : ""}${invoice.school.phone ? ` (tél. ${invoice.school.phone})` : ""}. Le reçu apparaîtra ici.`}
              />
            </Card>
          )}
        </div>

        <aside className="flex flex-col gap-6" aria-label="Suivi des paiements">
          <Card>
            <CardHeader>
              <CardTitle>Mes déclarations</CardTitle>
            </CardHeader>
            {invoice.declarations.length === 0 ? (
              <EmptyState title="Aucune déclaration" description="Les paiements que vous déclarez apparaissent ici avec leur état." />
            ) : (
              <ul className="divide-y divide-border">
                {invoice.declarations.map((d) => {
                  const s = DECLARATION[d.status];
                  return (
                    <li key={d.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:px-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold tabular-nums">{formatFcfa(d.amount)}</span>
                        <Badge tone={s.tone}>
                          <s.Icon aria-hidden /> {s.label}
                        </Badge>
                      </div>
                      <p className="text-muted">
                        {PAYMENT_METHOD_LABELS[d.method]} · réf. {d.transactionRef} · le {formatDate(d.createdAt)}
                      </p>
                      {d.note && <p>Motif : {d.note}</p>}
                      {d.proofFileId && (
                        <a href={fileUrl(d.proofFileId)!} className="font-semibold text-primary underline-offset-4 hover:underline" target="_blank" rel="noreferrer">
                          Voir la preuve envoyée
                        </a>
                      )}
                      {d.paymentId && (
                        <Link href={`/espace/frais/paiements/${d.paymentId}/recu`} className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline">
                          <ReceiptText className="size-4" aria-hidden /> Reçu
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {online.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Paiements en ligne</CardTitle>
              </CardHeader>
              <ul className="divide-y divide-border">
                {online.map((o) => {
                  const s = ONLINE[o.status];
                  return (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm sm:px-5">
                      <span>
                        <span className="font-semibold tabular-nums">{formatFcfa(o.amount)}</span> <span className="text-muted">le {formatDate(o.createdAt)}</span>
                      </span>
                      {o.status === "PENDING" ? (
                        <Link href={`/espace/payer/retour/${o.id}`} className="font-semibold text-primary underline-offset-4 hover:underline">
                          Suivre
                        </Link>
                      ) : (
                        <Badge tone={s.tone}>{s.label}</Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <p className="flex gap-2 text-sm text-muted">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {provider
                ? "Le paiement en ligne passe par FedaPay, prestataire béninois agréé : Classéo ne détient ni votre code ni votre carte. "
                : "Le paiement en ligne automatique n'est pas encore activé : déclarez ici un paiement fait sur un compte de l'école, la comptabilité le vérifie. "}
              Classéo n&apos;est pas raccordé directement aux API des opérateurs Mobile Money ; c&apos;est le prestataire de paiement qui s&apos;en charge.
            </span>
          </p>
          <ButtonLink href="/espace/payer" variant="ghost" className="self-start lg:hidden">
            <ArrowLeft aria-hidden /> Toutes les factures
          </ButtonLink>
        </aside>
      </div>
    </>
  );
}
