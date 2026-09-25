import { cn, formatNumber } from "@/lib/utils";

export type LineSeries = { name: string; values: (number | null)[]; color?: string };

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];
const W = 640;
const H = 240;
const PAD = { top: 20, right: 20, bottom: 34, left: 44 };

// Line chart for an evolution over periods (terms, months), in SVG rendered
// on the server. Soft guide lines, a filled area under a single series, the
// value written at each point, and a larger target on hover or keyboard
// focus that shows the point's period and value. A table with the same
// figures is given to screen readers; the drawing is hidden from them.
export function LineChart({
  labels,
  series,
  min = 0,
  max,
  format = formatNumber,
  label,
  reference,
  className,
}: {
  labels: string[];
  series: LineSeries[];
  min?: number;
  max?: number;
  format?: (n: number) => string;
  label: string;
  reference?: { value: number; label: string };
  className?: string;
}) {
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const top = max ?? Math.max(min + 1, ...all) * 1.1;
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (labels.length === 1 ? iw / 2 : (i / (labels.length - 1)) * iw);
  const y = (v: number) => PAD.top + ih - ((v - min) / (top - min)) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => min + (top - min) * f);
  const single = series.length === 1;

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
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible" aria-hidden focusable="false">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="ds-line-grid" />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="ds-line-tick">
              {format(t)}
            </text>
          </g>
        ))}
        {reference && (
          <line x1={PAD.left} x2={W - PAD.right} y1={y(reference.value)} y2={y(reference.value)} className="ds-line-ref" />
        )}
        {labels.map((l, i) => (
          <text key={l} x={x(i)} y={H - 10} textAnchor="middle" className="ds-line-tick">
            {l}
          </text>
        ))}
        {series.map((s, si) => {
          const color = s.color ?? COLORS[si % COLORS.length];
          const pts = s.values.map((v, i) => (v === null ? null : ([x(i), y(v)] as const)));
          const path = pts.reduce((acc, p, i) => (p ? `${acc}${acc && pts[i - 1] ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}` : acc), "");
          const present = pts.filter(Boolean) as (readonly [number, number])[];
          const area =
            single && present.length > 1
              ? `${path}L${present[present.length - 1]![0].toFixed(1)},${(PAD.top + ih).toFixed(1)}L${present[0]![0].toFixed(1)},${(PAD.top + ih).toFixed(1)}Z`
              : null;
          return (
            <g key={s.name} style={{ color }}>
              {area && <path d={area} className="ds-line-area" />}
              <path d={path} className="ds-line-path" />
              {s.values.map((v, i) =>
                v === null ? null : (
                  <g key={i} className="ds-line-point">
                    <circle cx={x(i)} cy={y(v)} r="4.5" />
                    <text x={x(i)} y={y(v) - 12} textAnchor="middle" className="ds-line-value">
                      {format(v)}
                    </text>
                  </g>
                ),
              )}
            </g>
          );
        })}
      </svg>
      {(series.length > 1 || reference) && (
        <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {series.length > 1 &&
            series.map((s, si) => (
              <span key={s.name} className="inline-flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: s.color ?? COLORS[si % COLORS.length] }} aria-hidden />
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
