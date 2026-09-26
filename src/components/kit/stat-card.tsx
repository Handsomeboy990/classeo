import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

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
  const body = (
    <>
      {/* Phone: the pictogram sits small before the label, which then has
          the card's whole width; from 40rem it is a tile on the right. */}
      <div className="flex items-start gap-2 sm:justify-between sm:gap-3">
        {Icon && (
          <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md sm:order-last sm:size-9 sm:rounded-control", toneCls)} aria-hidden>
            <Icon className="size-3.5 sm:size-5" />
          </span>
        )}
        <p lang="fr" className="min-w-0 text-[0.8125rem] leading-snug font-medium text-balance text-muted sm:text-sm">
          {label}
        </p>
      </div>
      <p className="mt-2.5 font-display text-[1.625rem] leading-none font-bold tracking-tight text-text tabular-nums sm:mt-2 sm:text-3xl">{value}</p>
      {hint && <p className="mt-1.5 text-xs leading-snug text-muted sm:mt-2 sm:text-hint">{hint}</p>}
    </>
  );
  const cls = "rounded-card border border-border bg-surface p-3.5 shadow-card sm:p-5";
  return href ? (
    <Link href={href} className={cn(cls, "block transition-[border-color,box-shadow] duration-150 hover:border-primary hover:shadow-raised")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  // Two per row from the smallest phone, four on large screens; a single
  // column when the text is enlarged (see globals.css, .ds-stat-grid).
  return <div className="ds-stat-grid grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">{children}</div>;
}
