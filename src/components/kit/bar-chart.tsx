import { cn, formatNumber } from "@/lib/utils";

const BAR = { primary: "bg-primary", accent: "bg-accent", warning: "bg-warning", danger: "bg-danger" };

// Horizontal bar chart in plain HTML: no chart library, readable by screen
// readers as a list, prints well, weighs nothing.
//
// Pass max for a fixed, meaningful scale (0 to 20 % for absences): without
// it the longest bar fills the track and small gaps look like big ones. A
// value beyond max fills the track. scale describes that range under the
// bars, so the length can be read. The flag yellow (accent) is for dark
// surfaces only; on a light card use warning or danger.
export function BarChart({
  data,
  format = formatNumber,
  max,
  scale,
  className,
  label,
}: {
  data: { label: string; value: number; href?: string; tone?: keyof typeof BAR }[];
  format?: (n: number) => string;
  max?: number;
  scale?: string;
  className?: string;
  label: string;
}) {
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  const list = (
    <ul aria-label={label} className={cn("flex flex-col gap-2.5", !scale && className)}>
      {data.map((d) => {
        const pct = Math.max(0, Math.min(100, (d.value / top) * 100));
        const bar = BAR[d.tone ?? "primary"];
        const content = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium text-text">{d.label}</span>
              <span className="shrink-0 font-semibold whitespace-nowrap text-text tabular-nums">{format(d.value)}</span>
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
  if (!scale) return list;
  return (
    <div className={className}>
      {list}
      <p className="mt-3 text-xs text-muted">{scale}</p>
    </div>
  );
}
