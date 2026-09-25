"use client";

import type { ReactNode } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { Textarea } from "@/components/ui/input";

import { decideRequest } from "../actions";

// Two explicit submit buttons, so the decision is one deliberate click with
// its reason written first. Once decided, the form stays mounted and shows
// the decision instead of its fields: the refreshed page arrives together
// with the action result, and unmounting the form would drop the toast.
export function DecisionForm({ id, decided }: { id: string; decided: ReactNode | null }) {
  return (
    <ActionForm action={decideRequest} className="flex flex-col gap-4">
      {decided ?? (
        <>
          <input type="hidden" name="id" value={id} />
          <FormField label="Note de décision" name="note" required hint="Elle sera transmise à l'établissement.">
            <Textarea rows={4} maxLength={2000} />
          </FormField>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <SubmitButton name="decision" value="REJECTED" variant="danger" pendingLabel="Traitement…">
              Refuser
            </SubmitButton>
            <SubmitButton name="decision" value="APPROVED" pendingLabel="Traitement…">
              Accorder
            </SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
