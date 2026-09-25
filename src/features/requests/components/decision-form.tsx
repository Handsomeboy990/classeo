"use client";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { Textarea } from "@/components/ui/input";

import { decideRequest } from "../actions";

// Two explicit submit buttons, so the decision is one deliberate click with
// its reason written first.
export function DecisionForm({ id }: { id: string }) {
  return (
    <ActionForm action={decideRequest} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={id} />
      <FormField label="Note de décision" name="note" required hint="Elle sera transmise à l'établissement.">
        <Textarea rows={4} maxLength={2000} />
      </FormField>
      <div className="flex flex-wrap justify-end gap-2">
        <SubmitButton name="decision" value="REJECTED" variant="danger" pendingLabel="Traitement…">
          Refuser
        </SubmitButton>
        <SubmitButton name="decision" value="APPROVED" pendingLabel="Traitement…">
          Accorder
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
