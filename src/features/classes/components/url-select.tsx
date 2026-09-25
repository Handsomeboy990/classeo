"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useTransition } from "react";

import { Label, Select } from "@/components/ui/input";

// A filter kept in the URL: changing it navigates, so the filtered view is
// shareable and survives a reload. Generic, used by the pedagogy lists.
export function UrlSelect({
  param,
  label,
  options,
  value,
  allLabel,
  resetParams = ["page"],
  className,
}: {
  param: string;
  label: string;
  options: { value: string; label: string }[];
  value?: string;
  allLabel?: string;
  resetParams?: string[];
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const id = useId();

  function change(next: string) {
    const qs = new URLSearchParams(params.toString());
    if (next) qs.set(param, next);
    else qs.delete(param);
    for (const p of resetParams) qs.delete(p);
    startTransition(() => router.push(`${pathname}?${qs.toString()}`, { scroll: false }));
  }

  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-1.5 flex items-center gap-2">
        {label}
        {pending && <Loader2 className="size-3.5 animate-spin text-muted" aria-label="Chargement" />}
      </Label>
      <Select id={id} value={value ?? ""} onChange={(e) => change(e.target.value)} aria-busy={pending || undefined}>
        {allLabel !== undefined && <option value="">{allLabel}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
