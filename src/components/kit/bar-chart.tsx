import Link from "next/link";

import { cn, formatNumber } from "@/lib/utils";

import { niceTicks } from "./chart-geometry";
import { EmptyState } from "./states";

const TONE = { primary: "var(--chart-1)", info: "var(--chart-2)", accent: "var(--chart-3)", warning: "var(--chart-3)", danger: "var(--chart-danger)" } as const;

export type BarDatum = { label: string; value: number; href?: string; tone?: keyof typeof TONE };

// Horizontal bar chart, drawn in HTML and CSS: no chart library, rendered on
// the server, readable at any text size and in print. Each row is its name,
// a rounded bar over a quiet track on a scale with light guide lines, and
// the value at the end of the bar; the bars grow in once (transform only,
// none under reduced motion) and a hovered row stands out. A reference line (the whole scope, a threshold) can cross
// every row. The rows are a list whose text holds the name and the value,
// so screen readers read "5e A, 68,1 %"; the guide lines and the scale are
// hidden from them. Rows with an href are links, with a visible focus.
//
// Pass max for a fixed, meaningful scale (0 to 20 % for absences): without
// it the longest bar fills the track and small gaps look like big ones.
// scale describes that range under the chart.
export function BarChart({
  data,
  format = formatNumber,
  max,
  scale,
  className,
  label,
  reference,
  tickFormat,
  empty = "Aucune valeur à afficher.",
}: {
  data: BarDatum[];
  format?: (n: number) => string;
  max?: number;
  scale?: string;
  className?: string;
  label: string;
  reference?: { value: number; label: string };
  // Labels of the scale, when they need fewer decimals than the values.
  tickFormat?: (n: number) => string;
  empty?: string;
}) {
  if (!data.length) return <EmptyState title={empty} className="py-8" />;
  // Without a fixed scale, the longest bar reaches a round figure, so the
  // scale reads 0, 1 000, 2 000, 3 000 rather than 0, 690, 1 380.
  const nice = max === undefined ? niceTicks(0, Math.max(1, ...data.map((d) => d.value))) : null;
  const top = max ?? nice![nice!.length - 1]!;
  const pct = (v: number) => Math.max(0, Math.min(100, (v / top) * 100));
  const ticks = nice ? nice.map((t) => t / top) : [0, 0.25, 0.5, 0.75, 1];
  return (
    <figure className={cn("ds-bars", className)}>
      <div className="ds-bars-plot">
        <div className="ds-bars-grid" aria-hidden>
          {ticks.map((f) => (
            <span key={f} style={{ left: `${f * 100}%` }} />
          ))}
          {reference && <span className="ds-bars-ref" style={{ left: `${pct(reference.value)}%` }} />}
        </div>
        <ul className="ds-bars-rows" aria-label={label}>
          {data.map((d) => {
            const p = pct(d.value);
            const row = (
              <>
                <span className="ds-bars-label">
                  {d.label}
                  <span className="sr-only"> : </span>
                </span>
                <span className="ds-bars-track">
                  <span className="ds-bars-bar" style={{ width: `${p}%`, background: TONE[d.tone ?? "primary"] }} aria-hidden />
                  <span className="ds-bars-value" style={{ left: `${p}%` }} data-inside={p > 80 || undefined}>
                    {format(d.value)}
                  </span>
                </span>
              </>
            );
            return (
              <li key={d.label}>
                {d.href ? (
                  <Link href={d.href} className="ds-bars-row" data-link="">
                    {row}
                  </Link>
                ) : (
                  <div className="ds-bars-row">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
        <div className="ds-bars-axis" aria-hidden>
          <span />
          <span className="ds-bars-ticks">
            {ticks.map((f) => (
              <span key={f} style={{ left: `${f * 100}%` }} data-edge={f === 0 ? "start" : f === 1 ? "end" : undefined}>
                {(tickFormat ?? format)(top * f)}
              </span>
            ))}
          </span>
        </div>
      </div>
      {(scale || reference) && (
        <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          {reference && (
            <span className="inline-flex items-center gap-1.5">
              <span className="ds-bars-ref-key" aria-hidden />
              {reference.label} : {format(reference.value)}
            </span>
          )}
          {scale && <span>{scale}</span>}
        </figcaption>
      )}
    </figure>
  );
}
