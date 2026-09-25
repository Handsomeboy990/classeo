"use client";

import { Ban } from "lucide-react";

import { FormDialog } from "@/components/kit/form-dialog";
import { FormField } from "@/components/kit/form-field";
import { Textarea } from "@/components/ui/input";

import { revokeDocument } from "../actions";

// Staff only: shown when the signed in account may revoke the document.
export function RevokeButton({ id, code, size = "md" }: { id: string; code: string; size?: "sm" | "md" }) {
  return (
    <FormDialog
      action={revokeDocument}
      trigger={
        <>
          <Ban aria-hidden /> Révoquer
        </>
      }
      triggerLabel={`Révoquer le document ${code}`}
      variant="danger-ghost"
      size={size}
      title={`Révoquer le document ${code} ?`}
      description="La page de vérification indiquera que ce document n'est plus valable. Un document signé perd aussi sa signature. L'opération est inscrite au journal d'activité."
      submitLabel="Révoquer le document"
      pendingLabel="Révocation…"
    >
      <input type="hidden" name="id" value={id} />
      <FormField label="Motif" name="reason" required hint="Par exemple : bulletin corrigé après impression, paiement annulé, copie déclarée perdue.">
        <Textarea rows={3} maxLength={300} />
      </FormField>
    </FormDialog>
  );
}
