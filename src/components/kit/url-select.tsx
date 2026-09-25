"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useTransition } from "react";

import { Label, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// A list filter kept in the URL: changing it navigates, so the filtered view
// is shareable and survives a reload. The page number is dropped on change.
// With hideLabel the label stays for screen readers only (toolbar filters).
export function UrlSelect({
  param,
  label,
  options,
  value,
  allLabel,
  resetParams = ["page"],
  hideLabel = false,
  replace = false,
  className,
}: {
  param: string;
  label: string;
  options: { value: string; label: string }[];
  // Defaults to the current value of the parameter in the URL.
  value?: string;
  allLabel?: string;
  resetParams?: string[];
  hideLabel?: boolean;
  // Replace the history entry instead of adding one.
  replace?: boolean;
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
    const query = qs.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    startTransition(() => (replace ? router.replace(href, { scroll: false }) : router.push(href, { scroll: false })));
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={id} className={hideLabel ? "sr-only" : "flex items-center gap-2"}>
        {label}
        {pending && <Loader2 className="size-3.5 animate-spin text-muted" aria-label="Chargement" />}
      </Label>
      <Select id={id} value={value ?? params.get(param) ?? ""} onChange={(e) => change(e.target.value)} aria-busy={pending || undefined}>
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
