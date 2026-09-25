"use client";

import { Trash2 } from "lucide-react";

import { ConfirmAction } from "@/components/kit/confirm-action";
import { Button } from "@/components/ui/button";

import { deleteFeeType, deletePlan } from "../actions";

export function DeleteFeeTypeButton({ id, name }: { id: string; name: string }) {
  return (
    <ConfirmAction
      action={deleteFeeType}
      fields={{ id }}
      title={`Supprimer « ${name} » ?`}
      description="Le type de frais et son échéancier seront supprimés. Un type de frais déjà facturé ne peut pas être supprimé : désactivez-le plutôt."
      confirmLabel="Supprimer"
      trigger={(open) => (
        <Button type="button" variant="ghost" size="sm" onClick={open} className="text-danger">
          <Trash2 aria-hidden /> Supprimer
        </Button>
      )}
    />
  );
}

export function DeletePlanButton({ id, name }: { id: string; name: string }) {
  return (
    <ConfirmAction
      action={deletePlan}
      fields={{ id }}
      title={`Supprimer l'échéancier « ${name} » ?`}
      description="Les prochaines factures de ce type seront émises en un seul paiement. Les factures déjà émises gardent leurs tranches."
      confirmLabel="Supprimer l'échéancier"
      trigger={(open) => (
        <Button type="button" variant="ghost" size="sm" onClick={open} className="text-danger">
          <Trash2 aria-hidden /> Supprimer l&apos;échéancier
        </Button>
      )}
    />
  );
}
