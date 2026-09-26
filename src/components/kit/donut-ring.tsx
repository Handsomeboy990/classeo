"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

export type RingPart = { label: string; value: number; color: string; display: string; share: string };

const R = 42;
const C = 2 * Math.PI * R;

// The ring and legend of kit/donut-chart.tsx, in the browser: pointing at a
// part (ring or legend row, mouse, touch or keyboard focus on the row)
// lifts it and writes its value and share in the middle; the others fade.
// The legend rows carry every figure in words, the accessible version.
export function DonutRing({ parts, total, totalLabel, label }: { parts: RingPart[]; total: string; totalLabel?: string; label: string }) {
  const [active, setActive] = useState<number | null>(null);
  const sum = parts.reduce((n, p) => n + p.value, 0);
  const gap = parts.filter((p) => p.value > 0).length > 1 ? 1.4 : 0;
  const shown = active === null ? null : parts[active]!;
  let offset = 0;

  return (
    <figure className="flex min-w-0 flex-wrap items-center gap-x-8 gap-y-5" onPointerLeave={() => setActive(null)}>
      <div className="relative size-36 shrink-0 sm:size-40">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden focusable="false">
          <circle cx="50" cy="50" r={R} className="ds-donut-track" />
          {sum > 0 &&
            parts.map((p, i) => {
              const len = (p.value / sum) * C;
              const seg = (
                <circle
                  key={p.label}
                  cx="50"
                  cy="50"
                  r={R}
                  className="ds-donut-seg"
                  data-dim={active !== null && active !== i ? "" : undefined}
                  data-active={active === i || undefined}
                  stroke={p.color}
                  strokeDasharray={`${Math.max(0, len - gap)} ${C}`}
                  strokeDashoffset={-offset}
                  onPointerEnter={() => setActive(i)}
                  onPointerDown={() => setActive(i)}
                />
              );
              offset += len;
              return seg;
            })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center" aria-hidden>
          <span className="font-display text-2xl leading-none font-bold tabular-nums">{shown ? shown.display : total}</span>
          <span className="mt-1 line-clamp-2 text-xs leading-tight text-muted">{shown ? `${shown.label} · ${shown.share}` : totalLabel}</span>
        </div>
      </div>
      <figcaption className="min-w-0 flex-1 basis-56">
        <p className="sr-only">
          {label}, {total} {totalLabel ?? "au total"}.
        </p>
        <ul className="flex flex-col gap-1">
          {parts.map((p, i) => (
            <li
              key={p.label}
              tabIndex={0}
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className={cn(
                "flex flex-wrap items-center gap-x-2.5 gap-y-0.5 rounded-md px-2 py-1.5 text-sm transition-colors outline-offset-1",
                active === i && "bg-surface-2",
                active !== null && active !== i && "opacity-60",
              )}
            >
              <span className="ds-donut-key" style={{ background: p.color }} aria-hidden />
              <span className="min-w-0 flex-1 basis-28 font-medium">{p.label}</span>
              <span className="font-semibold tabular-nums">{p.display}</span>
              <span className="min-w-12 text-right text-muted tabular-nums">{p.share}</span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
