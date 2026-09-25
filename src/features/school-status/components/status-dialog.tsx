"use client";

import { Power, PowerOff } from "lucide-react";
import { useState } from "react";

import { FormDialog } from "@/components/kit/form-dialog";
import { FormField } from "@/components/kit/form-field";
import { ChoiceGroup, Radio, Textarea } from "@/components/ui/input";

import { setSchoolStatus } from "../actions";
import { SCHOOL_STATUS_EFFECTS, type SchoolStatus } from "../labels";

const CHOICES: Record<SchoolStatus, { value: SchoolStatus; label: string }[]> = {
  ACTIVE: [
    { value: "SUSPENDED", label: "Suspendre" },
    { value: "CLOSED", label: "Fermer" },
  ],
  SUSPENDED: [
    { value: "ACTIVE", label: "Réactiver" },
    { value: "CLOSED", label: "Fermer" },
  ],
  CLOSED: [{ value: "ACTIVE", label: "Réactiver" }],
};

// Suspend, close or reactivate a school, with a mandatory reason. The trigger
// reads "Désactiver" on an active school and "Réactiver" otherwise.
export function SchoolStatusDialog({ id, name, status, size = "md" }: { id: string; name: string; status: SchoolStatus; size?: "sm" | "md" }) {
  const choices = CHOICES[status];
  const [choice, setChoice] = useState<SchoolStatus>(choices[0]!.value);
  const active = status === "ACTIVE";
  const verb = active ? "Désactiver" : "Réactiver";
  return (
    <FormDialog
      action={setSchoolStatus}
      trigger={
        <>
          {active ? <PowerOff aria-hidden /> : <Power aria-hidden />} {verb}
        </>
      }
      triggerVariant={active ? "danger-ghost" : "secondary"}
      triggerSize={size}
      triggerLabel={`${verb} ${name}`}
      title={active ? `Suspendre ou fermer ${name}` : `Statut de ${name}`}
      description="La décision est tracée dans le journal et notifiée au personnel de l'établissement."
      submitLabel="Confirmer la décision"
    >
      <input type="hidden" name="id" value={id} />
      <ChoiceGroup legend="Décision">
        {choices.map((c) => (
          <Radio key={c.value} name="status" value={c.value} checked={choice === c.value} onChange={() => setChoice(c.value)} label={c.label} description={SCHOOL_STATUS_EFFECTS[c.value]} />
        ))}
      </ChoiceGroup>
      <FormField label="Motif" name="reason" required hint="Obligatoire. Il est affiché à l'établissement.">
        <Textarea rows={3} maxLength={500} />
      </FormField>
    </FormDialog>
  );
}
