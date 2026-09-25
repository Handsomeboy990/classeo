import Link from "next/link";
import type { ReactNode } from "react";

import type { SearchParams } from "@/lib/list";
import { cn } from "@/lib/utils";

// Filter chips kept in the URL: shareable, survive reload, no client state.
export function FilterLinks({
  label,
  param,
  options,
  current,
  searchParams,
  basePath,
}: {
  label: string;
  param: string;
  options: { value: string | undefined; label: string; icon?: ReactNode }[];
  current: string | undefined;
  searchParams: SearchParams;
  basePath: string;
}) {
  function href(value: string | undefined) {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (typeof v === "string" && k !== param && k !== "page") next.set(k, v);
    if (value) next.set(param, value);
    const qs = next.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = o.value === current;
          return (
            <li key={o.label}>
              <Link
                href={href(o.value)}
                aria-current={active ? "page" : undefined}
                scroll={false}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold [&_svg]:size-4",
                  active ? "border-primary bg-primary text-on-primary" : "border-border-strong bg-surface text-text hover:bg-surface-2",
                )}
              >
                {o.icon}
                {o.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
