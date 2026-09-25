"use client";

import { CheckCircle2, Clock, ReceiptText, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ButtonLink } from "@/components/ui/button";
import { formatFcfa } from "@/lib/utils";

type State = { status: "CREATED" | "PENDING" | "APPROVED" | "DECLINED" | "CANCELED" | "REFUNDED"; amount: number; invoiceId: string; payment: { id: string; reference: string } | null };

// Back from the provider's page: asks the server every few seconds until
// the payment is settled. The status in the return address is ignored, as
// the provider's documentation requires; only our record counts.
export function ReturnStatus({ id, initial }: { id: string; initial: State }) {
  const [state, setState] = useState(initial);
  const [tries, setTries] = useState(0);
  const waiting = state.status === "PENDING" || state.status === "CREATED";

  useEffect(() => {
    if (!waiting || tries > 60) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/paiements/en-ligne/${id}`, { cache: "no-store" });
        if (res.ok) setState(await res.json());
      } finally {
        setTries((t) => t + 1);
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [id, waiting, tries]);

  if (state.status === "APPROVED")
    return (
      <div role="status" className="flex flex-col gap-4 rounded-card border border-success/30 bg-success-soft p-5">
        <p className="flex items-center gap-2 text-lg font-bold text-success">
          <CheckCircle2 className="size-6" aria-hidden /> Paiement confirmé
        </p>
        <p>
          {formatFcfa(state.amount)} ont bien été reçus.{" "}
          {state.payment ? `Reçu ${state.payment.reference}.` : "Le service de la comptabilité termine l'enregistrement et vous prévient."}
        </p>
        <div className="flex flex-wrap gap-2">
          {state.payment && (
            <ButtonLink href={`/espace/frais/paiements/${state.payment.id}/recu`}>
              <ReceiptText aria-hidden /> Voir le reçu
            </ButtonLink>
          )}
          <ButtonLink href={`/espace/payer/${state.invoiceId}`} variant="secondary">
            Retour à la facture
          </ButtonLink>
        </div>
      </div>
    );

  if (waiting)
    return (
      <div role="status" aria-live="polite" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5">
        <p className="flex items-center gap-2 text-lg font-bold">
          <Clock className="size-6 text-muted" aria-hidden /> Paiement en cours de confirmation
        </p>
        <p className="text-muted">
          {tries > 60
            ? "La confirmation tarde. Si vous avez validé le paiement sur votre téléphone, il apparaîtra sur la facture dès que le prestataire l'aura confirmé ; vous serez prévenu."
            : "Validez le paiement sur votre téléphone si ce n'est pas déjà fait. Cette page se met à jour toute seule."}
        </p>
        <Link href={`/espace/payer/${state.invoiceId}`} className="font-semibold text-primary underline-offset-4 hover:underline">
          Retour à la facture
        </Link>
      </div>
    );

  return (
    <div role="alert" className="flex flex-col gap-3 rounded-card border border-danger/30 bg-danger-soft p-5">
      <p className="flex items-center gap-2 text-lg font-bold text-danger">
        <XCircle className="size-6" aria-hidden /> {state.status === "REFUNDED" ? "Paiement remboursé" : "Paiement non abouti"}
      </p>
      <p>{state.status === "REFUNDED" ? "Ce paiement a été remboursé par le prestataire." : "Aucun montant n'a été enregistré. Vous pouvez réessayer, ou payer autrement."}</p>
      <ButtonLink href={`/espace/payer/${state.invoiceId}`} variant="secondary" className="self-start">
        Réessayer
      </ButtonLink>
    </div>
  );
}
