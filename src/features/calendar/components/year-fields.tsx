"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { useFormState } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export type YearFormValues = {
  id?: string;
  label: string;
  startDate: string;
  endDate: string;
  periods: { name: string; startDate: string; endDate: string }[];
};

// Fields of the year form, placed in a FormDialog. Periods are rows the
// ministry adds or removes (two semesters, three terms, at most four).
export function YearFields({ values }: { values: YearFormValues }) {
  const [periods, setPeriods] = useState(values.periods.map((p, i) => ({ ...p, key: i })));
  const [next, setNext] = useState(values.periods.length);
  const state = useFormState();
  const periodError = ["periodName", "periodStart", "periodEnd"].map((k) => state?.fieldErrors?.[k]?.[0]).find(Boolean);

  function add() {
    setPeriods((p) => [...p, { name: `Période ${p.length + 1}`, startDate: "", endDate: "", key: next }]);
    setNext((n) => n + 1);
  }

  return (
    <>
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <FormField label="Libellé" name="label" required hint="Deux années qui se suivent, par exemple 2027-2028.">
        <Input defaultValue={values.label} maxLength={9} autoComplete="off" />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Rentrée" name="startDate" required>
          <Input type="date" defaultValue={values.startDate} />
        </FormField>
        <FormField label="Fin des cours" name="endDate" required info="L'année se ferme d'elle-même le lendemain.">
          <Input type="date" defaultValue={values.endDate} />
        </FormField>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-text">Périodes de l&apos;année</legend>
        <p className="text-sm text-muted">Semestres ou trimestres, dans l&apos;ordre, sans chevauchement.</p>
        {periods.map((p, i) => (
          <div key={p.key} className="grid grid-cols-2 gap-2 rounded-control border border-border p-3 sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-end">
            <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
              <Label htmlFor={`period-name-${p.key}`}>Nom de la période {i + 1}</Label>
              <Input id={`period-name-${p.key}`} name="periodName[]" defaultValue={p.name} maxLength={40} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`period-start-${p.key}`}>Début</Label>
              <Input id={`period-start-${p.key}`} name="periodStart[]" type="date" defaultValue={p.startDate} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`period-end-${p.key}`}>Fin</Label>
              <Input id={`period-end-${p.key}`} name="periodEnd[]" type="date" defaultValue={p.endDate} required />
            </div>
            <Button
              type="button"
              variant="danger-ghost"
              size="icon-sm"
              className="col-span-2 justify-self-end sm:col-span-1"
              disabled={periods.length <= 2}
              onClick={() => setPeriods((list) => list.filter((x) => x.key !== p.key))}
              aria-label={`Retirer la période ${i + 1}`}
              title={`Retirer la période ${i + 1}`}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        ))}
        {periodError && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {periodError}
          </p>
        )}
        {periods.length < 4 && (
          <Button type="button" variant="secondary" onClick={add} className="self-start">
            <Plus aria-hidden /> Ajouter une période
          </Button>
        )}
      </fieldset>
    </>
  );
}
