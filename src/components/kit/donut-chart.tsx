import { cn, formatNumber, formatPercent } from "@/lib/utils";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

// Donut for a share of a whole (girls and boys, payment modes): few parts,
// each drawn with a thin gap, the total in the middle, and a legend that
// gives every part's value and percentage in words. The legend is the
// accessible version; the ring is hidden from screen readers.
export function DonutChart({
  data,
  label,
  total: totalLabel,
  format = formatNumber,
  className,
}: {
  data: { label: string; value: number; color?: string }[];
  label: string;
  // Text under the number in the middle, e.g. "élèves".
  total?: string;
  format?: (n: number) => string;
  className?: string;
}) {
  const sum = data.reduce((n, d) => n + d.value, 0);
  const R = 42;
  const C = 2 * Math.PI * R;
  const gap = data.filter((d) => d.value > 0).length > 1 ? 1.2 : 0;
  let offset = 0;
  return (
    <figure className={cn("flex flex-wrap items-center gap-x-8 gap-y-4", className)}>
      <div className="relative size-36 shrink-0">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden focusable="false">
          <circle cx="50" cy="50" r={R} className="ds-donut-track" />
          {sum > 0 &&
            data.map((d, i) => {
              const len = (d.value / sum) * C;
              const seg = (
                <circle
                  key={d.label}
                  cx="50"
                  cy="50"
                  r={R}
                  className="ds-donut-seg"
                  stroke={d.color ?? COLORS[i % COLORS.length]}
                  strokeDasharray={`${Math.max(0, len - gap)} ${C}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return seg;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center" aria-hidden>
          <span className="font-display text-2xl leading-none font-bold tabular-nums">{format(sum)}</span>
          {totalLabel && <span className="mt-1 text-xs text-muted">{totalLabel}</span>}
        </div>
      </div>
      <figcaption className="min-w-0 flex-1">
        <p className="sr-only">
          {label}, {format(sum)} {totalLabel ?? "au total"}.
        </p>
        <ul className="flex flex-col gap-2.5">
          {data.map((d, i) => (
            <li key={d.label} className="flex items-center gap-2.5 text-sm">
              <span className="ds-donut-key" style={{ background: d.color ?? COLORS[i % COLORS.length] }} aria-hidden />
              <span className="min-w-0 flex-1 font-medium">{d.label}</span>
              <span className="font-semibold tabular-nums">{format(d.value)}</span>
              <span className="w-14 text-right text-muted tabular-nums">{formatPercent(sum ? d.value / sum : 0)}</span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
