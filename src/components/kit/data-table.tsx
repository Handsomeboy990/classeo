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
  // Hidden below this breakpoint to keep tables usable on phones. With the
  // phone card layout, "sm" and "md" columns come back in the card (there is
  // room for them there) and "lg" columns stay out unless mobileHidden is
  // set to false.
  hideBelow?: "sm" | "md" | "lg";
  // Title of the phone card. Defaults to the first column.
  primary?: boolean;
  // Left out of the phone card.
  mobileHidden?: boolean;
  // Row actions, shown at the end of the phone card. Defaults to true for a
  // column headed "Actions".
  actions?: boolean;
  // Label in the phone card, when the header is too terse or empty.
  mobileLabel?: string;
};

// Table layout (from 40rem, or at every width without cards).
const hide = { sm: "max-sm:hidden", md: "max-md:hidden", lg: "max-lg:hidden" };
// With cards, below 40rem the card decides; above, the table hides as before.
const hideWithCards = { sm: "", md: "sm:max-md:hidden", lg: "sm:max-lg:hidden" };

const isEmpty = (v: ReactNode) => v === null || v === undefined || v === false || v === "";

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
  density = "comfortable",
  mobile = "cards",
  striped = false,
  stickyHeader = true,
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
  density?: "comfortable" | "compact";
  // "cards": each row becomes a card on a phone; "table": keep the table and
  // let it scroll sideways (wide grids that only make sense as a grid).
  mobile?: "cards" | "table";
  striped?: boolean;
  stickyHeader?: boolean;
}) {
  const cards = mobile === "cards";
  const primaryIndex = Math.max(
    0,
    columns.findIndex((c) => c.primary),
  );
  const meta = columns.map((c, i) => ({
    primary: cards && (columns.some((x) => x.primary) ? !!c.primary : i === primaryIndex),
    actions: cards && (c.actions ?? c.header === "Actions"),
    cardHidden: cards && (c.mobileHidden ?? c.hideBelow === "lg"),
    hideCls: c.hideBelow ? (cards ? hideWithCards : hide)[c.hideBelow] : undefined,
    label: c.mobileLabel ?? c.header,
  }));
  // A search or a filter in the URL: an empty list means "no match", not
  // "nothing yet".
  const filtered = Object.entries(searchParams).some(([k, v]) => k !== "page" && typeof v === "string" && v !== "");
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
    <div className="rounded-card border border-border bg-surface shadow-card">
      {(searchPlaceholder !== false || toolbar) && (
        <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-4">
          {searchPlaceholder !== false ? <SearchInput placeholder={searchPlaceholder} /> : <span className="max-sm:hidden" />}
          {toolbar && (
            // Phone: filters two by two, a lone last item takes the full row.
            <div className="grid grid-cols-2 gap-2 *:min-w-0 max-sm:*:w-full sm:flex sm:flex-wrap sm:items-center max-sm:[&>*:last-child:nth-child(odd)]:col-span-2">
              {toolbar}
            </div>
          )}
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} variant={filtered ? "no-results" : "empty"} />
      ) : (
        <Table density={density} sticky={stickyHeader} striped={striped} cards={cards}>
          <caption className="sr-only">{caption}</caption>
          <THead>
            <tr>
              {columns.map((c, i) => (
                <TH key={c.header} className={cn(c.className, meta[i]!.hideCls)}>
                  {c.header}
                </TH>
              ))}
            </tr>
          </THead>
          <tbody>
            {rows.map((row) => (
              <TR key={rowKey(row)}>
                {columns.map((c, i) => {
                  const m = meta[i]!;
                  const value = c.cell(row);
                  return (
                    <TD
                      key={c.header}
                      className={cn(c.className, m.hideCls)}
                      data-label={cards ? m.label : undefined}
                      data-primary={m.primary || undefined}
                      data-actions={m.actions || undefined}
                      data-card-hidden={m.cardHidden || undefined}
                      data-empty={cards && isEmpty(value) ? "" : undefined}
                    >
                      {value}
                    </TD>
                  );
                })}
              </TR>
            ))}
          </tbody>
        </Table>
      )}
      {count > 0 && (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted">
          <p className="min-w-0">
            <span className="font-semibold text-text tabular-nums">{formatNumber(count)}</span> résultat{count > 1 ? "s" : ""}
            {pages > 1 && (
              <span className="tabular-nums">
                {" "}
                · page {page} sur {pages}
              </span>
            )}
          </p>
          {pages > 1 && (
            <div className="flex shrink-0 gap-2">
              <PageLink href={pageHref(page - 1)} disabled={page <= 1} label="Page précédente">
                <ChevronLeft className="size-4" aria-hidden />
              </PageLink>
              <PageLink href={pageHref(page + 1)} disabled={page >= pages} label="Page suivante">
                <ChevronRight className="size-4" aria-hidden />
              </PageLink>
            </div>
          )}
        </nav>
      )}
    </div>
  );
}

function PageLink({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: ReactNode }) {
  const cls = "inline-flex size-11 items-center justify-center rounded-control border border-border-strong bg-surface text-text sm:size-9";
  if (disabled)
    return (
      <span className={cn(cls, "opacity-40")} aria-disabled="true" aria-label={label} role="link">
        {children}
      </span>
    );
  return (
    <Link href={href} className={cn(cls, "shadow-xs transition-colors hover:border-field-border hover:bg-surface-2")} aria-label={label} scroll={false}>
      {children}
    </Link>
  );
}
