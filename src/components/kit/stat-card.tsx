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
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm leading-snug font-medium text-muted">{label}</p>
        {Icon && (
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-control", toneCls)} aria-hidden>
            <Icon className="size-5" />
          </span>
        )}
      </div>
      <p className="mt-2 font-display text-2xl leading-none sm:text-3xl font-bold tracking-tight text-text tabular-nums">{value}</p>
      {hint && <p className="mt-2 text-hint text-muted">{hint}</p>}
    </>
  );
  const cls = "rounded-card border border-border bg-surface p-4 shadow-card sm:p-5";
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
