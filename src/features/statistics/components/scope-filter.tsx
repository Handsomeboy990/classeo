"use client";

import { Filter } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";

type Option = { id: string; name: string };

// Territory filter of the statistics page: department, then commune. Plain
// GET form, so it works without JavaScript; with JavaScript a change applies
// at once and a department change clears the commune.
export function ScopeFilter({
  departments,
  communes,
  departmentId,
  communeId,
  keep,
}: {
  departments: Option[] | null;
  communes: Option[];
  departmentId: string | null;
  communeId: string | null;
  keep: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function apply(form: HTMLFormElement, clearCommune: boolean) {
    const data = new FormData(form);
    const next = new URLSearchParams();
    for (const [k, v] of data.entries()) if (typeof v === "string" && v) next.set(k, v);
    if (clearCommune) next.delete("commune");
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  return (
    <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end" aria-busy={pending || undefined}>
      {Object.entries(keep).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {departments && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-department">Département</Label>
          <Select id="filter-department" name="departement" defaultValue={departmentId ?? ""} onChange={(e) => apply(e.currentTarget.form!, true)} className="sm:w-56">
            <option value="">Tout le Bénin</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      {communes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-commune">Commune</Label>
          <Select key={`${departmentId}-${communeId}`} id="filter-commune" name="commune" defaultValue={communeId ?? ""} onChange={(e) => apply(e.currentTarget.form!, false)} className="sm:w-56">
            <option value="">Toutes les communes</option>
            {communes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      <Button type="submit" variant="secondary" loading={pending}>
        <Filter aria-hidden /> Appliquer
      </Button>
    </form>
  );
}
