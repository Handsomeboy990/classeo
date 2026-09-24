import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import type { SearchParams } from "@/lib/list";
import { cn, formatNumber } from "@/lib/utils";

import { SearchInput } from "./search-input";
import { EmptyState } from "./states";

export type Column<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  // Hidden below this breakpoint to keep tables usable on phones.
  hideBelow?: "sm" | "md" | "lg";
};

const hide = { sm: "max-sm:hidden", md: "max-md:hidden", lg: "max-lg:hidden" };

// Server rendered table: search and pagination live in the URL, so a list is
// shareable, survives reload and needs no client data library.
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  total,
  page = 1,
  pageSize = 20,
  searchParams = {},
  basePath,
  searchPlaceholder,
  toolbar,
  emptyTitle = "Aucun résultat",
  emptyDescription,
  caption,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  total?: number;
  page?: number;
  pageSize?: number;
  searchParams?: SearchParams;
  basePath: string;
  searchPlaceholder?: string | false;
  toolbar?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  caption: string;
}) {
  const count = total ?? rows.length;
  const pages = Math.max(1, Math.ceil(count / pageSize));

  function pageHref(p: number) {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (typeof v === "string" && k !== "page") next.set(k, v);
    if (p > 1) next.set("page", String(p));
    const qs = next.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  return (
    <div className="rounded-card border border-border bg-surface">
      {(searchPlaceholder !== false || toolbar) && (
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          {searchPlaceholder !== false ? <SearchInput placeholder={searchPlaceholder} /> : <span />}
          {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <Table>
          <caption className="sr-only">{caption}</caption>
          <THead>
            <tr>
              {columns.map((c) => (
                <TH key={c.header} className={cn(c.className, c.hideBelow && hide[c.hideBelow])}>
                  {c.header}
                </TH>
              ))}
            </tr>
          </THead>
          <tbody>
            {rows.map((row) => (
              <TR key={rowKey(row)}>
                {columns.map((c) => (
                  <TD key={c.header} className={cn(c.className, c.hideBelow && hide[c.hideBelow])}>
                    {c.cell(row)}
                  </TD>
                ))}
              </TR>
            ))}
          </tbody>
        </Table>
      )}
      {count > 0 && (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted">
          <span>
            {formatNumber(count)} résultat{count > 1 ? "s" : ""} · page {page} sur {pages}
          </span>
          <div className="flex gap-2">
            <PageLink href={pageHref(page - 1)} disabled={page <= 1} label="Page précédente">
              <ChevronLeft className="size-4" aria-hidden />
            </PageLink>
            <PageLink href={pageHref(page + 1)} disabled={page >= pages} label="Page suivante">
              <ChevronRight className="size-4" aria-hidden />
            </PageLink>
          </div>
        </nav>
      )}
    </div>
  );
}

function PageLink({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: ReactNode }) {
  const cls = "inline-flex size-9 items-center justify-center rounded-lg border border-border-strong";
  if (disabled)
    return (
      <span className={cn(cls, "opacity-40")} aria-disabled="true" aria-label={label}>
        {children}
      </span>
    );
  return (
    <Link href={href} className={cn(cls, "hover:bg-surface-2")} aria-label={label} scroll={false}>
      {children}
    </Link>
  );
}
