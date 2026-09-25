import { Filter, X } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

export type FilterField =
  | { kind: "select"; name: string; label: string; value: string | null; options: { value: string; label: string; group?: string }[]; allLabel: string }
  | { kind: "date"; name: string; label: string; value: string | null }
  | { kind: "text"; name: string; label: string; value: string | null; placeholder?: string };

// List filters as a plain GET form: they live in the URL, work without
// JavaScript and survive a reload. The search box of the DataTable is kept
// through a hidden field; the page number is dropped on purpose.
export function FilterBar({ fields, basePath, keep = {} }: { fields: FilterField[]; basePath: string; keep?: Record<string, string | null | undefined> }) {
  const active = fields.some((f) => f.value);
  return (
    <form method="get" action={basePath} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 sm:flex-row sm:flex-wrap sm:items-end">
      {Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      {fields.map((f) => {
        const id = `filter-${f.name}`;
        return (
          <div key={f.name} className="flex min-w-0 flex-col gap-1.5 sm:w-48">
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
      <div className="flex gap-2">
        <Button type="submit" variant="secondary">
          <Filter aria-hidden /> Filtrer
        </Button>
        {active && (
          <Link href={basePath} className="inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-text">
            <X className="size-4" aria-hidden /> Réinitialiser
          </Link>
        )}
      </div>
    </form>
  );
}

function groupOptions(options: { value: string; label: string; group?: string }[]) {
  const groups = new Map<string, typeof options>();
  for (const o of options) groups.set(o.group ?? "", [...(groups.get(o.group ?? "") ?? []), o]);
  return [...groups.entries()];
}
