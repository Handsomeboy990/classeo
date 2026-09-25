"use client";

import type { ReactNode } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { Input, Select, Textarea } from "@/components/ui/input";

import { decideRequest } from "../actions";

export type ExtensionChoice = { years: { id: string; label: string }[]; defaultYearId: string | null; defaultUntil: string };

// Two explicit submit buttons, so the decision is one deliberate click with
// its reason written first. Once decided, the form stays mounted and shows
// the decision instead of its fields: the refreshed page arrives together
// with the action result, and unmounting the form would drop the toast.
// For a year extension, approving also sets the year kept open and the date.
export function DecisionForm({ id, decided, extension }: { id: string; decided: ReactNode | null; extension?: ExtensionChoice }) {
  return (
    <ActionForm action={decideRequest} className="flex flex-col gap-4">
      {decided ?? (
        <>
          <input type="hidden" name="id" value={id} />
          {extension && (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Année à prolonger" name="academicYearId" hint="Utilisée seulement si vous accordez.">
                <Select defaultValue={extension.defaultYearId ?? ""}>
                  {extension.years.length === 0 && <option value="">Aucune année close</option>}
                  {extension.years.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Jusqu'au" name="until" hint="Fin de la saisie autorisée.">
                <Input type="date" defaultValue={extension.defaultUntil} />
              </FormField>
            </div>
          )}
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
