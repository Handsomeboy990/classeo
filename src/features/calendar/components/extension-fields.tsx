"use client";

import { useState } from "react";

import { FormField } from "@/components/kit/form-field";
import { ChoiceGroup, Input, Radio, Textarea } from "@/components/ui/input";

import { SchoolPicker, type PickableSchool } from "./school-picker";

// Fields of the extension form: every school or chosen ones, until a date.
export function ExtensionFields({ academicYearId, schools, defaultUntil }: { academicYearId: string; schools: PickableSchool[]; defaultUntil: string }) {
  const [target, setTarget] = useState<"all" | "schools">("schools");
  return (
    <>
      <input type="hidden" name="academicYearId" value={academicYearId} />
      <ChoiceGroup legend="Établissements concernés" orientation="horizontal">
        <Radio name="target" value="schools" checked={target === "schools"} onChange={() => setTarget("schools")} label="Certains établissements" />
        <Radio name="target" value="all" checked={target === "all"} onChange={() => setTarget("all")} label="Tous les établissements" />
      </ChoiceGroup>
      {target === "schools" && <SchoolPicker schools={schools} />}
      <FormField label="Jusqu'au" name="until" required hint="La saisie reste possible jusqu'à la fin de ce jour.">
        <Input type="date" defaultValue={defaultUntil} />
      </FormField>
      <FormField label="Motif" name="reason" required hint="Il est communiqué aux établissements concernés.">
        <Textarea rows={3} maxLength={500} />
      </FormField>
    </>
  );
}
