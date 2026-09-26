"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { labelStep, segments, smoothPath } from "./chart-geometry";

export type PlotSeries = { name: string; color: string; values: (number | null)[]; display: (string | null)[] };

const HEIGHT = 240;
const PAD = { top: 22, right: 16, bottom: 32, left: 44 };
const FALLBACK_WIDTH = 640;

// The drawing of kit/line-chart.tsx, in the browser: it measures its own
// width so the text keeps its size on a phone (a scaled viewBox would shrink
// it to 7 px), and adds a crosshair with a tooltip on hover, touch or the
// arrow keys. Everything it shows is also in the table of the figure, the
// accessible version; the live region repeats the period under the cursor.
export function LineChartPlot({
  labels,
  series,
  min,
  top,
  ticks,
  reference,
}: {
  labels: string[];
  series: PlotSeries[];
  min: number;
  top: number;
  ticks: { value: number; display: string }[];
  reference?: { value: number; display: string; label: string };
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  const [active, setActive] = useState<number | null>(null);
  const gradientId = useId();

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => entry && setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const iw = width - PAD.left - PAD.right;
  const ih = HEIGHT - PAD.top - PAD.bottom;
  const n = labels.length;
  const x = (i: number) => PAD.left + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => PAD.top + ih - ((v - min) / (top - min || 1)) * ih;
  const step = labelStep(n, iw);
  // Values written on the points only when they have room.
  const gap = n > 1 ? iw / (n - 1) : iw;
  const showValues = series.length === 1 && gap >= 44;
  const single = series.length === 1;

  function indexAt(clientX: number) {
    const r = box.current?.getBoundingClientRect();
    if (!r || n === 0) return null;
    const px = clientX - r.left;
    if (n === 1) return 0;
    return Math.max(0, Math.min(n - 1, Math.round(((px - PAD.left) / iw) * (n - 1))));
  }

  function onPointer(e: PointerEvent<HTMLDivElement>) {
    setActive(indexAt(e.clientX));
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End", "Escape"].includes(e.key)) return;
    e.preventDefault();
    if (e.key === "Escape") return setActive(null);
    setActive((a) => {
      if (e.key === "Home") return 0;
      if (e.key === "End") return n - 1;
      if (a === null) return e.key === "ArrowLeft" ? n - 1 : 0;
      return Math.max(0, Math.min(n - 1, a + (e.key === "ArrowRight" ? 1 : -1)));
    });
  }

  const tipLeft = active === null ? 0 : Math.min(Math.max(x(active), 80), width - 80);
  const announce = active === null ? "" : `${labels[active]} : ${series.map((s) => `${s.name} ${s.display[active] ?? "pas de valeur"}`).join(", ")}`;

  return (
    <div
      ref={box}
      className="ds-line-plot relative"
      tabIndex={0}
      aria-label="Graphique. Les flèches gauche et droite parcourent les périodes."
      onPointerMove={onPointer}
      onPointerDown={onPointer}
      onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
      onKeyDown={onKey}
      onBlur={() => setActive(null)}
    >
      <svg width="100%" height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} className="block overflow-visible" aria-hidden focusable="false">
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={series[0]?.color} stopOpacity="0.24" />
            <stop offset="100%" stopColor={series[0]?.color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t.value}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t.value)} y2={y(t.value)} className="ds-line-grid" />
            <text x={PAD.left - 10} y={y(t.value)} dy="0.32em" textAnchor="end" className="ds-line-tick">
              {t.display}
            </text>
          </g>
        ))}
        {reference && <line x1={PAD.left} x2={width - PAD.right} y1={y(reference.value)} y2={y(reference.value)} className="ds-line-ref" />}
        {labels.map((l, i) =>
          i % step === 0 || i === n - 1 ? (
            <text key={`${l}-${i}`} x={x(i)} y={HEIGHT - 8} textAnchor={n > 1 && i === 0 ? "start" : n > 1 && i === n - 1 ? "end" : "middle"} className="ds-line-tick" data-active={active === i || undefined}>
              {l}
            </text>
          ) : null,
        )}
        {active !== null && <line x1={x(active)} x2={x(active)} y1={PAD.top - 6} y2={PAD.top + ih} className="ds-line-cursor" />}
        {series.map((s) => (
          <g key={s.name} style={{ color: s.color }}>
            {segments(s.values).map((seg) => {
              const pts = seg.values.map((v, k) => [x(seg.start + k), y(v)] as const);
              const d = smoothPath(pts);
              const base = (PAD.top + ih).toFixed(1);
              return (
                <g key={seg.start}>
                  {single && pts.length > 1 && <path d={`${d}L${pts[pts.length - 1]![0].toFixed(1)},${base}L${pts[0]![0].toFixed(1)},${base}Z`} fill={`url(#${gradientId})`} />}
                  <path d={d} className="ds-line-path" />
                </g>
              );
            })}
            {s.values.map((v, i) =>
              v === null ? null : (
                <g key={i} className="ds-line-point" data-active={active === i || undefined}>
                  <circle cx={x(i)} cy={y(v)} r={active === i ? 6 : 4} />
                  {showValues && active !== i && (
                    <text x={x(i)} y={y(v) - 12} textAnchor={n > 1 && i === 0 ? "start" : n > 1 && i === n - 1 ? "end" : "middle"} className="ds-line-value">
                      {s.display[i]}
                    </text>
                  )}
                </g>
              ),
            )}
          </g>
        ))}
      </svg>
      {active !== null && (
        <div className="ds-chart-tip" style={{ left: tipLeft, top: Math.max(0, Math.min(...series.map((s) => (s.values[active] === null ? HEIGHT : y(s.values[active]!)))) - 12) }} aria-hidden>
          <p className="font-semibold">{labels[active]}</p>
          {series.map((s) => (
            <p key={s.name} className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
              {series.length > 1 && <span className="min-w-0 flex-1 truncate opacity-80">{s.name}</span>}
              <span className="font-bold tabular-nums">{s.display[active] ?? "Aucune valeur"}</span>
            </p>
          ))}
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
