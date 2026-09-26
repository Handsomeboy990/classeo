import { cn, formatNumber } from "@/lib/utils";

import { niceTicks } from "./chart-geometry";
import { LineChartPlot } from "./line-chart-plot";
import { EmptyState } from "./states";

export type LineSeries = { name: string; values: (number | null)[]; color?: string };

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

// Line chart for an evolution over periods (terms, years). Rendered on the
// server with every text already formatted, drawn in the browser by
// LineChartPlot (smooth line, soft area under a single series, a crosshair
// and tooltip on hover, touch or arrow keys, text at its real size on any
// width). A table with the same figures is given to screen readers; the
// drawing is hidden from them. With no value at all, an empty state.
export function LineChart({
  labels,
  series,
  min = 0,
  max,
  format = formatNumber,
  label,
  reference,
  empty = "Pas encore de valeur à afficher.",
  className,
}: {
  labels: string[];
  series: LineSeries[];
  min?: number;
  max?: number;
  format?: (n: number) => string;
  label: string;
  reference?: { value: number; label: string };
  empty?: string;
  className?: string;
}) {
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  if (!all.length) return <EmptyState title={empty} className="py-8" />;
  const ticks = max !== undefined ? niceTicks(min, max).filter((t) => t <= max) : niceTicks(min, Math.max(min + 1, ...all, reference?.value ?? min));
  const top = max ?? ticks[ticks.length - 1]!;
  const plotted = series.map((s, i) => ({ name: s.name, color: s.color ?? COLORS[i % COLORS.length]!, values: s.values, display: s.values.map((v) => (v === null ? null : format(v))) }));

  return (
    <figure className={cn("ds-line", className)}>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Période</th>
            {series.map((s) => (
              <th key={s.name} scope="col">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((l, i) => (
            <tr key={l}>
              <th scope="row">{l}</th>
              {series.map((s) => (
                <td key={s.name}>{s.values[i] === null ? "Pas de valeur" : format(s.values[i]!)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <LineChartPlot
        labels={labels}
        series={plotted}
        min={min}
        top={top}
        ticks={ticks.map((t) => ({ value: t, display: format(t) }))}
        reference={reference ? { ...reference, display: format(reference.value) } : undefined}
      />
      {(series.length > 1 || reference) && (
        <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted">
          {series.length > 1 &&
            plotted.map((s) => (
              <span key={s.name} className="inline-flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
                {s.name}
              </span>
            ))}
          {reference && (
            <span className="inline-flex items-center gap-1.5">
              <span className="ds-bars-ref-key" aria-hidden />
              {reference.label} : {format(reference.value)}
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
}
