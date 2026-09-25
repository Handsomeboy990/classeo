"use client";

import { Undo2 } from "lucide-react";

import { ConfirmAction } from "@/components/kit/confirm-action";
import { Button } from "@/components/ui/button";
import { announceSuccess } from "@/features/fees/components/toast-action";
import { formatFcfa } from "@/lib/utils";

import { cancelPayment } from "../actions";

const cancel = announceSuccess(cancelPayment);

export function CancelPaymentButton({ id, reference, amount }: { id: string; reference: string; amount: number }) {
  return (
    <ConfirmAction
      action={cancel}
      fields={{ id }}
      title={`Annuler le paiement ${reference} ?`}
      description={`Le versement de ${formatFcfa(amount)} sera retiré de la facture et les tranches seront recalculées. Cette opération est inscrite au journal d'activité.`}
      confirmLabel="Annuler le paiement"
      trigger={(open) => (
        <Button type="button" variant="ghost" size="sm" onClick={open} className="text-danger">
          <Undo2 aria-hidden /> Annuler
        </Button>
      )}
    />
  );
}
