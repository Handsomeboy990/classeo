import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

// Key figure: the label as a small capitals overline, the figure in
// Montserrat 700 with tabular digits, and a 3 px rule along the top of the
// card in the colour of its series (the chart palette). No solid coloured
// fill: the tone shows in the rule and the pictogram tile only.
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "primary" | "accent" | "info" | "danger" | "warning";
  href?: string;
}) {
  const toneCls = {
    primary: "bg-primary-soft text-primary",
    accent: "bg-accent-soft text-on-accent",
    info: "bg-info-soft text-info",
    danger: "bg-danger-soft text-danger",
    warning: "bg-warning-soft text-warning",
  }[tone];
  const rule = {
    primary: "before:bg-(--chart-1)",
    info: "before:bg-(--chart-2)",
    accent: "before:bg-(--chart-3)",
    warning: "before:bg-(--chart-3)",
    danger: "before:bg-(--chart-danger)",
  }[tone];
  const body = (
    <>
      {/* Phone: the pictogram sits small before the label; from 40rem it is
          a tile on the right. When the label's longest word and the
          pictogram do not fit side by side, the row wraps: a word is never
          cut to make room. */}
      <div className="flex flex-wrap items-start gap-2 sm:justify-between sm:gap-3">
        {Icon && (
          <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-control sm:order-last sm:size-9", toneCls)} aria-hidden>
            <Icon className="size-3.5 sm:size-5" />
          </span>
        )}
        <p lang="fr" data-stat-label className="min-w-min grow basis-0 font-display text-[0.6875rem] leading-snug font-bold tracking-[0.08em] text-balance break-normal wrap-normal hyphens-manual text-muted uppercase">
          {label}
        </p>
      </div>
      <p data-stat-value className="mt-2.5 font-display text-[1.625rem] leading-[1.1] font-bold text-text tabular-nums sm:mt-2 sm:text-[1.75rem]">
        <FigureParts value={value} />
      </p>
      {hint && <p className="mt-1.5 text-xs leading-snug text-muted sm:mt-2 sm:text-hint">{hint}</p>}
    </>
  );
  const cls = cn(
    // No overflow clipping: the grid track then keeps the card as wide as
    // its figure. The rule follows the inner corners of the card instead.
    "relative rounded-card border border-border bg-surface p-3.5 shadow-card sm:p-5",
    "before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:rounded-t-[calc(var(--radius-card)-1px)] before:content-['']",
    rule,
  );
  return href ? (
    <Link href={href} className={cn(cls, "block transition-[border-color,box-shadow] duration-150 hover:border-primary/40 hover:shadow-[var(--elevation-sm)]")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

// A figure never wraps: "19 523" split over two lines reads as two other
// numbers. A value that lists several figures or names ("14,25 / 6,50",
// "6e A, 5e B") may break between them only.
function FigureParts({ value }: { value: string }) {
  return value.split(/(, | \/ )/).map((part, i) =>
    i % 2 ? (
      part
    ) : (
      <span key={i} data-stat-figure className="whitespace-nowrap">
        {part}
      </span>
    ),
  );
}

// Columns follow the width the grid has, at every text size: four, two or
// one, never three (the cards go by pairs). See globals.css, .ds-stat-grid.
// `wide` for figures of about fourteen characters, such as amounts in FCFA
// ("5 645 000 FCFA"): wider cards, so they fit on one line.
export function StatGrid({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="ds-stat-wrap">
      <div className="ds-stat-grid" data-wide={wide || undefined}>
        {children}
      </div>
    </div>
  );
}
