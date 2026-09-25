"use client";

import { useId, useState } from "react";

import { useFormState } from "@/components/kit/action-form";
import { Checkbox, Input, Label } from "@/components/ui/input";

export type PickableSchool = { id: string; name: string; code: string; commune: string };

// A searchable list of checkboxes submitting schoolIds[]. The filter only
// hides rows: checked schools stay submitted when they scroll out of view.
export function SchoolPicker({ schools, name = "schoolIds[]", errorKey = "schoolIds", legend = "Établissements" }: { schools: PickableSchool[]; name?: string; errorKey?: string; legend?: string }) {
  const [q, setQ] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const id = useId();
  const error = useFormState()?.fieldErrors?.[errorKey]?.[0];
  const needle = q.trim().toLowerCase();
  const visible = (s: PickableSchool) => !needle || `${s.name} ${s.code} ${s.commune}`.toLowerCase().includes(needle);

  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="text-sm font-semibold text-text">{legend}</legend>
      <Label htmlFor={`${id}-q`} className="sr-only">
        Rechercher un établissement
      </Label>
      <Input id={`${id}-q`} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher par nom, code ou commune…" autoComplete="off" />
      <p className="text-sm text-muted" aria-live="polite">
        {checked.size === 0 ? "Aucun établissement choisi." : `${checked.size} établissement${checked.size > 1 ? "s" : ""} choisi${checked.size > 1 ? "s" : ""}.`}
      </p>
      <div className="max-h-64 overflow-y-auto rounded-control border border-border p-2">
        {schools.map((s) => (
          <div key={s.id} hidden={!visible(s)}>
            <Checkbox
              name={name}
              value={s.id}
              checked={checked.has(s.id)}
              onChange={(e) =>
                setChecked((prev) => {
                  const next = new Set(prev);
                  if (e.target.checked) next.add(s.id);
                  else next.delete(s.id);
                  return next;
                })
              }
              label={s.name}
              description={`${s.code}, ${s.commune}`}
            />
          </div>
        ))}
      </div>
      {error && (
        <p id={`${id}-error`} className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
