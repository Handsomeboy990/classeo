import { cn, formatNumber } from "@/lib/utils";

// Horizontal bar chart in plain HTML: no chart library, readable by screen
// readers as a list, prints well, weighs nothing.
export function BarChart({
  data,
  format = formatNumber,
  max,
  className,
  label,
}: {
  data: { label: string; value: number; href?: string; tone?: "primary" | "accent" | "danger" }[];
  format?: (n: number) => string;
  max?: number;
  className?: string;
  label: string;
}) {
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <ul aria-label={label} className={cn("flex flex-col gap-2.5", className)}>
      {data.map((d) => {
        const pct = Math.max(0, Math.min(100, (d.value / top) * 100));
        const bar = d.tone === "danger" ? "bg-danger" : d.tone === "accent" ? "bg-accent" : "bg-primary";
        const content = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium text-text">{d.label}</span>
              <span className="shrink-0 font-semibold text-text tabular-nums">{format(d.value)}</span>
            </div>
            <div className="mt-1 h-2.5 rounded-full bg-surface-2" aria-hidden>
              <div className={cn("h-full rounded-full", bar)} style={{ width: `${pct}%` }} />
            </div>
          </>
        );
        return (
          <li key={d.label}>
            {d.href ? (
              <a href={d.href} className="block rounded-md p-1 -m-1 hover:bg-surface-2">
                {content}
              </a>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ul>
  );
}
