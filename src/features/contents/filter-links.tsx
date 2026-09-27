import Link from "next/link";
import type { ReactNode } from "react";

import type { SearchParams } from "@/lib/list";

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
    <nav aria-label={label} className="ds-segmented self-start">
      {options.map((o) => {
        const active = o.value === current;
        return (
          <Link key={o.label} href={href(o.value)} aria-current={active ? "page" : undefined} scroll={false} className="[&_svg]:size-4">
            {o.icon}
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}
