"use client";

import { Undo2 } from "lucide-react";

import { ConfirmButton } from "@/components/kit/confirm-button";
import { announceSuccess } from "@/features/fees/components/toast-action";
import { formatFcfa } from "@/lib/utils";

import { cancelPayment } from "../actions";

const cancel = announceSuccess(cancelPayment);

export function CancelPaymentButton({ id, reference, amount }: { id: string; reference: string; amount: number }) {
  return (
    <ConfirmButton
      action={cancel}
      fields={{ id }}
      title={`Annuler le paiement ${reference} ?`}
      description={`Le versement de ${formatFcfa(amount)} sera retiré de la facture et les tranches seront recalculées. Cette opération est inscrite au journal d'activité.`}
      confirmLabel="Annuler le paiement"
      variant="danger-ghost"
      size="sm"
      label={`Annuler le paiement ${reference}`}
    >
      <Undo2 aria-hidden /> Annuler
    </ConfirmButton>
  );
}
