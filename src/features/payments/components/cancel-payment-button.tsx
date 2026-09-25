"use client";

import { Undo2 } from "lucide-react";

import { ConfirmAction } from "@/components/kit/confirm-action";
import { Button } from "@/components/ui/button";
import { formatFcfa } from "@/lib/utils";

import { cancelPayment } from "../actions";

export function CancelPaymentButton({ id, reference, amount }: { id: string; reference: string; amount: number }) {
  return (
    <ConfirmAction
      action={cancelPayment}
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
