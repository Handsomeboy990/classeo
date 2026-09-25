"use client";

import { Check, Plus, Power, X } from "lucide-react";

import { ConfirmButton } from "@/components/kit/confirm-button";
import { FormDialog } from "@/components/kit/form-dialog";
import { FormField } from "@/components/kit/form-field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { announceSuccess } from "@/features/fees/components/toast-action";
import { formatFcfa } from "@/lib/utils";

import { confirmDeclaration, createPaymentAccount, rejectDeclaration, togglePaymentAccount } from "../actions";

// The row disappears from the queue once decided: the toast is raised as
// soon as the action answers.
const confirm = announceSuccess(confirmDeclaration);
const reject = announceSuccess(rejectDeclaration);

export function DecisionButtons({ id, amount, reference, who }: { id: string; amount: number; reference: string; who: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ConfirmButton
        action={confirm}
        fields={{ id }}
        title={`Confirmer ${formatFcfa(amount)} pour ${who} ?`}
        description={`Confirmez seulement après avoir retrouvé la transaction ${reference} sur le relevé du compte. Le paiement est enregistré sur la facture avec son reçu, et le parent est prévenu.`}
        confirmLabel="Confirmer le paiement"
        tone="primary"
        variant="primary"
        size="sm"
      >
        <Check aria-hidden /> Confirmer
      </ConfirmButton>
      <FormDialog
        action={reject}
        trigger={
          <>
            <X aria-hidden /> Refuser
          </>
        }
        variant="danger-ghost"
        size="sm"
        title={`Refuser la déclaration ${reference} ?`}
        description="Le parent reçoit le motif et peut déclarer à nouveau avec la bonne référence."
        submitLabel="Refuser"
        pendingLabel="Envoi…"
      >
        <input type="hidden" name="id" value={id} />
        <FormField label="Motif" name="note" required hint="Par exemple : transaction introuvable sur le relevé, montant différent.">
          <Textarea rows={3} maxLength={300} />
        </FormField>
      </FormDialog>
    </div>
  );
}

export function AddAccountButton() {
  return (
    <FormDialog
      action={createPaymentAccount}
      trigger={
        <>
          <Plus aria-hidden /> Ajouter un compte
        </>
      }
      title="Nouveau compte de paiement"
      description="Les parents le voient sur la page de paiement et y envoient leurs versements."
      submitLabel="Ajouter"
    >
      <FormField label="Type" name="channel" required>
        <Select defaultValue="MOBILE_MONEY">
          <option value="MOBILE_MONEY">Mobile Money</option>
          <option value="BANK">Compte bancaire</option>
        </Select>
      </FormField>
      <FormField label="Opérateur ou banque" name="provider" required hint="MTN MoMo, Moov Money, Celtiis Cash, nom de la banque…">
        <Input maxLength={60} />
      </FormField>
      <FormField label="Titulaire" name="accountName" required>
        <Input maxLength={120} />
      </FormField>
      <FormField label="Numéro de téléphone ou RIB" name="accountNumber" required>
        <Input maxLength={60} autoComplete="off" />
      </FormField>
      <FormField label="Consignes aux parents (facultatif)" name="instructions" hint="Par exemple : indiquez le nom de l'élève en motif du transfert.">
        <Textarea rows={2} maxLength={400} />
      </FormField>
    </FormDialog>
  );
}

export function ToggleAccountButton({ id, active, label }: { id: string; active: boolean; label: string }) {
  return (
    <ConfirmButton
      action={togglePaymentAccount}
      fields={{ id, active: active ? "false" : "true" }}
      title={active ? `Désactiver ${label} ?` : `Réactiver ${label} ?`}
      description={active ? "Il n'est plus proposé aux parents. Les déclarations déjà faites sur ce compte restent à traiter." : "Il est à nouveau proposé aux parents."}
      confirmLabel={active ? "Désactiver" : "Réactiver"}
      tone={active ? "danger" : "primary"}
      variant={active ? "danger-ghost" : "soft"}
      size="sm"
    >
      <Power aria-hidden /> {active ? "Désactiver" : "Réactiver"}
    </ConfirmButton>
  );
}
