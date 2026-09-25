"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useTransition } from "react";

import { Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// A list filter kept in the URL, like the search box: shareable and kept on
// reload. Changing it goes back to the first page.
export function FilterSelect({
  param,
  label,
  options,
  allLabel,
  className,
}: {
  param: string;
  label: string;
  options: { value: string; label: string }[];
  allLabel?: string;
  className?: string;
}) {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function change(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(param, value);
    else next.delete(param);
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return (
    <div className={cn("w-full sm:w-auto", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Select id={id} value={params.get(param) ?? ""} onChange={(e) => change(e.target.value)} aria-busy={pending || undefined} className="sm:w-52">
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
