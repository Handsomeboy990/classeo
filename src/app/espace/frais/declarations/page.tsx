import { CheckCircle2, Clock, Globe, Inbox, Paperclip, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/kit/page-header";
import { EmptyState } from "@/components/kit/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireFeeStaff } from "@/features/fees/access";
import { FeesNav } from "@/features/fees/components/fees-nav";
import { feesTabs } from "@/features/fees/nav";
import { DecisionButtons } from "@/features/online-payment/components/staff-controls";
import { declarationQueue } from "@/features/online-payment/queries";
import { can } from "@/lib/auth/authorize";
import { PAYMENT_METHOD_LABELS } from "@/lib/domain/payments";
import { fileUrl } from "@/lib/files";
import { formatDate, formatFcfa } from "@/lib/utils";

export const metadata: Metadata = { title: "Paiements des parents" };

const ONLINE = {
  CREATED: { tone: "neutral", label: "Non commencé" },
  PENDING: { tone: "warning", label: "En attente" },
  APPROVED: { tone: "success", label: "Payé" },
  DECLINED: { tone: "danger", label: "Refusé" },
  CANCELED: { tone: "neutral", label: "Abandonné" },
  REFUNDED: { tone: "neutral", label: "Remboursé" },
} as const;

export default async function DeclarationsPage() {
  const user = await requireFeeStaff("payment:view");
  const { pending, decided, online } = await declarationQueue(user);
  const canDecide = can(user, "payment:create");

  return (
    <>
      <PageHeader title="Paiements des parents" description={`Déclarations Mobile Money et virements à vérifier, paiements en ligne · ${user.scope.label}`} />
      <FeesNav items={feesTabs(user)} />

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>À vérifier ({pending.length})</CardTitle>
              <CardDescription>Retrouvez chaque transaction sur le relevé du compte avant de la confirmer. La plus ancienne en premier.</CardDescription>
            </div>
          </CardHeader>
          {pending.length === 0 ? (
            <EmptyState icon={<Inbox className="size-7" />} title="Aucune déclaration en attente" description="Les paiements déclarés par les parents apparaissent ici." />
          ) : (
            <ul className="divide-y divide-border">
              {pending.map((d) => {
                const s = d.invoice.enrollment.student;
                const who = `${s.lastName} ${s.firstName}`;
                return (
                  <li key={d.id} className="flex flex-col gap-3 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {formatFcfa(d.amount)} <span className="font-normal text-muted">· {PAYMENT_METHOD_LABELS[d.method]}</span>
                      </p>
                      <p className="text-sm">
                        {who} · {d.invoice.enrollment.classroom.name} ·{" "}
                        <Link href={`/espace/frais/factures/${d.invoice.id}`} className="font-semibold text-primary underline-offset-2 hover:underline">
                          facture {d.invoice.number}
                        </Link>
                      </p>
                      <p className="text-sm text-muted">
                        Réf. <span className="font-mono font-semibold text-text">{d.transactionRef}</span>
                        {d.payerPhone ? ` · depuis le ${d.payerPhone}` : ""}
                        {d.account ? ` · vers ${d.account}` : ""} · déclaré le {formatDate(d.createdAt)}
                      </p>
                      {d.proofFileId && (
                        <a href={fileUrl(d.proofFileId)!} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-2 hover:underline">
                          <Paperclip className="size-4" aria-hidden /> Preuve jointe
                        </a>
                      )}
                    </div>
                    {canDecide && <DecisionButtons id={d.id} amount={d.amount} reference={d.transactionRef} who={who} />}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="grid grid-cols-1 gap-6 *:min-w-0 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Déclarations traitées</CardTitle>
            </CardHeader>
            {decided.length === 0 ? (
              <EmptyState title="Aucune déclaration traitée" />
            ) : (
              <ul className="divide-y divide-border">
                {decided.map((d) => (
                  <li key={d.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">
                        {formatFcfa(d.amount)} · {d.invoice.enrollment.student.lastName} {d.invoice.enrollment.student.firstName}
                      </span>
                      {d.status === "CONFIRMED" ? (
                        <Badge tone="success">
                          <CheckCircle2 aria-hidden /> Confirmé
                        </Badge>
                      ) : (
                        <Badge tone="danger">
                          <XCircle aria-hidden /> Refusé
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted">
                      Réf. {d.transactionRef} · {d.decidedAt ? `traité le ${formatDate(d.decidedAt)}` : ""}
                      {d.note ? ` · ${d.note}` : ""}
                    </p>
                    {d.paymentId && (
                      <Link href={`/espace/frais/paiements/${d.paymentId}/recu`} className="font-semibold text-primary underline-offset-2 hover:underline">
                        Reçu
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Paiements en ligne</CardTitle>
                <CardDescription>Confirmés par le prestataire et enregistrés automatiquement.</CardDescription>
              </div>
            </CardHeader>
            {online.length === 0 ? (
              <EmptyState icon={<Globe className="size-7" />} title="Aucun paiement en ligne" />
            ) : (
              <ul className="divide-y divide-border">
                {online.map((o) => {
                  const s = ONLINE[o.status];
                  const review = o.lastEvent && typeof o.lastEvent === "object" && "review" in o.lastEvent ? String((o.lastEvent as { review: unknown }).review) : null;
                  return (
                    <li key={o.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:px-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">
                          {formatFcfa(o.amount)} · {o.invoice.enrollment.student.lastName} {o.invoice.enrollment.student.firstName}
                        </span>
                        <Badge tone={s.tone}>
                          {o.status === "PENDING" && <Clock aria-hidden />} {s.label}
                        </Badge>
                      </div>
                      <p className="text-muted">
                        {o.provider} {o.providerRef ? `n° ${o.providerRef}` : ""} · facture {o.invoice.number} · le {formatDate(o.createdAt)}
                      </p>
                      {review && <p className="font-semibold text-warning">À vérifier : {review}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
