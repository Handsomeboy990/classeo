import { Filter, X } from "lucide-react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { FilterDisclosure } from "./filter-disclosure";

export type FilterField =
  | { kind: "select"; name: string; label: string; value: string | null; options: { value: string; label: string; group?: string }[]; allLabel: string }
  | { kind: "date"; name: string; label: string; value: string | null }
  | { kind: "text"; name: string; label: string; value: string | null; placeholder?: string };

// List filters as a plain GET form: they live in the URL, work without
// JavaScript and survive a reload. The search box of the DataTable is kept
// through a hidden field; the page number is dropped on purpose. On a phone
// the fields go two by two, a lone last field taking the full row, and three
// fields or more fold behind a "Filtres" button.
export function FilterBar({ fields, basePath, keep = {} }: { fields: FilterField[]; basePath: string; keep?: Record<string, string | null | undefined> }) {
  const activeCount = fields.filter((f) => f.value).length;
  const body = (
    <>
      {fields.map((f, i) => {
        const id = `filter-${f.name}`;
        const lone = i === fields.length - 1 && fields.length % 2 === 1;
        return (
          <div key={f.name} className={cn("flex min-w-0 flex-col gap-1.5 sm:w-48", lone && "max-sm:col-span-2")}>
            <Label htmlFor={id}>{f.label}</Label>
            {f.kind === "select" ? (
              <Select id={id} name={f.name} defaultValue={f.value ?? ""}>
                <option value="">{f.allLabel}</option>
                {groupOptions(f.options).map(([group, options]) =>
                  group ? (
                    <optgroup key={group} label={group}>
                      {options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </optgroup>
                  ) : (
                    options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))
                  ),
                )}
              </Select>
            ) : (
              <Input id={id} name={f.name} type={f.kind} defaultValue={f.value ?? ""} placeholder={f.kind === "text" ? f.placeholder : undefined} />
            )}
          </div>
        );
      })}
      <div className="col-span-2 flex gap-2 max-sm:*:flex-1">
        <Button type="submit" variant="secondary">
          <Filter aria-hidden /> Filtrer
        </Button>
        {activeCount > 0 && (
          <ButtonLink href={basePath} variant="ghost" className="text-muted hover:text-text">
            <X aria-hidden /> Réinitialiser
          </ButtonLink>
        )}
      </div>
    </>
  );
  return (
    <form
      method="get"
      action={basePath}
      className="grid grid-cols-2 gap-3 rounded-card border border-border bg-surface p-3 sm:flex sm:flex-row sm:flex-wrap sm:items-end sm:p-4"
    >
      {Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      {fields.length >= 3 ? <FilterDisclosure active={activeCount}>{body}</FilterDisclosure> : body}
    </form>
  );
}

function groupOptions(options: { value: string; label: string; group?: string }[]) {
  const groups = new Map<string, typeof options>();
  for (const o of options) groups.set(o.group ?? "", [...(groups.get(o.group ?? "") ?? []), o]);
  return [...groups.entries()];
}
