"use client";

import { CircleAlert, Search } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox, Input, Radio } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { useFormState } from "./action-form";

export type PickerOption = { value: string; label: string; group: string; detail?: string };

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

// A searchable list of checkboxes, grouped, for choosing several recipients.
// The choice is submitted as hidden `${name}[]` inputs (`${name}` for a single
// choice), so what is ticked survives a search that hides it and a refused
// submission.
export function MultiPicker({
  name,
  legend,
  hint,
  options,
  selected,
  onChange,
  max,
  searchPlaceholder = "Rechercher par nom…",
  single = false,
}: {
  name: string;
  legend: string;
  hint?: string;
  options: PickerOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  max?: number;
  searchPlaceholder?: string;
  // One choice at most: ticking an entry replaces the previous one.
  single?: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const state = useFormState();
  const error = state?.fieldErrors?.[name]?.[0];
  const visible = useMemo(() => {
    const q = fold(query.trim());
    return q ? options.filter((o) => fold(`${o.label} ${o.group} ${o.detail ?? ""}`).includes(q)) : options;
  }, [options, query]);
  const groups = [...new Set(visible.map((o) => o.group))];
  const chosen = new Set(selected);
  const full = !!max && selected.length >= max;
  const labelOf = new Map(options.map((o) => [o.value, o.label]));
  const Choice = single ? Radio : Checkbox;

  function toggle(value: string, on: boolean) {
    if (single) return onChange(on ? [value] : []);
    onChange(on ? [...selected, value] : selected.filter((v) => v !== value));
  }

  return (
    <fieldset className="min-w-0" aria-describedby={[hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined}>
      <legend className="text-sm font-semibold text-text">{legend}</legend>
      {hint && (
        <p id={`${id}-hint`} className="mt-0.5 text-sm text-muted">
          {hint}
        </p>
      )}
      {selected.map((v) => (
        <input key={v} type="hidden" name={single ? name : `${name}[]`} value={v} />
      ))}
      <div className="mt-2 flex flex-col gap-2">
        <label htmlFor={`${id}-q`} className="sr-only">
          {searchPlaceholder}
        </label>
        <Input
          id={`${id}-q`}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          leading={<Search className="size-4" aria-hidden />}
          aria-invalid={error ? true : undefined}
          aria-controls={`${id}-list`}
          onKeyDown={(e) => {
            // Enter in the search field must not submit the whole form.
            if (e.key === "Enter") e.preventDefault();
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p role="status" className="text-muted">
            {selected.length === 0 ? "Aucun destinataire choisi" : `${selected.length} choisi${selected.length > 1 ? "s" : ""}`}
            {max && !single ? `, ${max} au plus` : ""}
          </p>
          {!single && (
            <div className="flex gap-2">
              {query.trim() && visible.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange([...new Set([...selected, ...visible.map((o) => o.value)])].slice(0, max ?? Infinity))}
                >
                  Tout cocher ({visible.length})
                </Button>
              )}
              {selected.length > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
                  Tout décocher
                </Button>
              )}
            </div>
          )}
        </div>
        {selected.length > 0 && (
          <p className="text-sm">
            <span className="sr-only">Choix : </span>
            {selected.map((v) => labelOf.get(v) ?? v).join(", ")}
          </p>
        )}
        <div id={`${id}-list`} className="max-h-72 overflow-y-auto rounded-lg border border-border-strong bg-surface p-2">
          {visible.length === 0 ? (
            <p className="p-2 text-sm text-muted">Aucun résultat pour « {query} ».</p>
          ) : (
            groups.map((g) => (
              <div key={g} role="group" aria-label={g} className="py-1">
                <p aria-hidden className="px-2 pb-1 text-xs font-bold tracking-wide text-muted uppercase">
                  {g}
                </p>
                {visible
                  .filter((o) => o.group === g)
                  .map((o) => {
                    const on = chosen.has(o.value);
                    return (
                      <Choice
                        key={o.value}
                        name={single ? `${id}-choice` : undefined}
                        checked={on}
                        disabled={!on && full && !single}
                        onChange={(e) => toggle(o.value, e.target.checked)}
                        label={o.label}
                        description={o.detail}
                        labelClassName={cn("rounded-md px-2 py-1.5 hover:bg-surface-2", on && "bg-primary-soft")}
                      />
                    );
                  })}
              </div>
            ))
          )}
        </div>
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-sm leading-snug font-semibold text-danger">
          <CircleAlert className="mt-px size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}
    </fieldset>
  );
}
