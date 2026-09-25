"use client";

import { Search } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { useFormState } from "@/components/kit/action-form";
import { Checkbox, ChoiceGroup, Input, Radio } from "@/components/ui/input";
import { cn, plural } from "@/lib/utils";

export type PickableSchool = { id: string; name: string; code: string; communeId: string; communeName: string; departmentId: string; departmentName: string; levelIds: string[] };

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Searchable list of schools with checkboxes. The selection travels as
// hidden fields, so a school filtered out by the search stays selected.
// With `home`, a school organiser searches its commune first, then its whole
// department.
export function SchoolPicker({
  schools,
  levelId,
  name,
  legend,
  home,
  exclude = [],
}: {
  schools: PickableSchool[];
  levelId: string | null;
  name: string;
  legend: string;
  home?: { communeId: string; communeName: string; departmentName: string };
  exclude?: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [area, setArea] = useState<"commune" | "department">("commune");
  const searchId = useId();
  const error = useFormState()?.fieldErrors?.[name]?.[0];

  const offered = useMemo(() => {
    const skip = new Set(exclude);
    const text = normalize(q.trim());
    return schools.filter(
      (s) =>
        !skip.has(s.id) &&
        (!levelId || s.levelIds.includes(levelId)) &&
        (!home || area === "department" || s.communeId === home.communeId) &&
        (!text || normalize(`${s.name} ${s.code} ${s.communeName}`).includes(text)),
    );
  }, [schools, levelId, home, area, q, exclude]);

  // A school no longer offered for the chosen level is dropped.
  const valid = [...selected].filter((id) => schools.some((s) => s.id === id && (!levelId || s.levelIds.includes(levelId))));

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="text-sm font-semibold text-text">{legend}</legend>
      {valid.map((id) => (
        <input key={id} type="hidden" name={`${name}[]`} value={id} />
      ))}
      {home && (
        <ChoiceGroup legend="Rechercher dans" orientation="horizontal">
          <Radio name={`${name}-area`} checked={area === "commune"} onChange={() => setArea("commune")} label={`Commune de ${home.communeName}`} />
          <Radio name={`${name}-area`} checked={area === "department"} onChange={() => setArea("department")} label={`Département ${home.departmentName}`} />
        </ChoiceGroup>
      )}
      <div>
        <label htmlFor={searchId} className="sr-only">
          Rechercher un établissement
        </label>
        <Input id={searchId} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, code ou commune…" leading={<Search />} autoComplete="off" />
      </div>
      <p className="text-sm text-muted" aria-live="polite">
        {plural(valid.length, "établissement choisi", "établissements choisis")} · {plural(offered.length, "établissement proposé", "établissements proposés")}
        {!levelId && " (choisissez d'abord la classe d'examen)"}
      </p>
      <ul className={cn("flex max-h-72 flex-col overflow-y-auto rounded-control border p-1", error ? "border-danger" : "border-border")} aria-label={legend}>
        {offered.length === 0 && <li className="p-3 text-sm text-muted">Aucun établissement ne correspond.</li>}
        {offered.map((s) => (
          <li key={s.id}>
            <Checkbox
              checked={selected.has(s.id)}
              onChange={(e) => toggle(s.id, e.target.checked)}
              label={s.name}
              description={`${s.code} · ${s.communeName}, ${s.departmentName}`}
              labelClassName="rounded-md px-2 py-1.5 hover:bg-surface-2"
            />
          </li>
        ))}
      </ul>
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
    </fieldset>
  );
}
