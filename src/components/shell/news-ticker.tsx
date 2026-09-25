"use client";

import { ChevronLeft, ChevronRight, Megaphone, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

export type TickerEntry = { id: string; title: string; summary: string | null };

const QUERY = "(prefers-reduced-motion: reduce)";
function subscribe(cb: () => void) {
  const mq = matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function useReducedMotion() {
  return useSyncExternalStore(subscribe, () => matchMedia(QUERY).matches, () => false);
}

// Speed of the band, in pixels per second: slow enough to read a title
// once without chasing it.
const SPEED = 55;

function Item({ entry, tabbable = true }: { entry: TickerEntry; tabbable?: boolean }) {
  return (
    <Link href={`/espace/contenus/${entry.id}`} tabIndex={tabbable ? undefined : -1} className="ticker-link">
      <span className="font-semibold">{entry.title}</span>
      {entry.summary && <span className="ticker-summary"> · {entry.summary}</span>}
    </Link>
  );
}

// Important announcements of the user's audience, as a band under the top
// bar like a news channel ticker. The band loops (transform only, linear)
// and stops while the pointer or the keyboard focus is on it, or with the
// pause button. With reduced motion it does not move at all: one
// announcement at a time with previous and next buttons. Screen readers get
// a list of every announcement, never the moving copy.
export function NewsTicker({ items }: { items: TickerEntry[] }) {
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(40);

  useEffect(() => {
    const el = track.current;
    if (!el || reduced) return;
    const ro = new ResizeObserver(() => setDuration(Math.max(12, el.scrollWidth / 2 / SPEED)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [reduced, items]);

  if (!items.length) return null;

  return (
    <section aria-labelledby="ticker-title" className="ticker" data-print-hide>
      <h2 id="ticker-title" className="ticker-label">
        <Megaphone className="size-4 shrink-0" aria-hidden />
        <span>Important</span>
      </h2>
      {reduced ? (
        <div className="ticker-viewport flex items-center">
          <ul className="min-w-0 flex-1">
            {items.map((e, i) => (
              <li key={e.id} className={cn("truncate", i !== index % items.length && "sr-only")}>
                <Item entry={e} tabbable={i === index % items.length} />
              </li>
            ))}
          </ul>
          {items.length > 1 && (
            <div className="flex shrink-0 items-center gap-0.5 pl-2">
              <span className="px-1 text-xs tabular-nums opacity-80" aria-hidden>
                {(index % items.length) + 1}/{items.length}
              </span>
              <button type="button" className="ticker-btn" onClick={() => setIndex((i) => (i - 1 + items.length) % items.length)} aria-label="Annonce précédente">
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <button type="button" className="ticker-btn" onClick={() => setIndex((i) => (i + 1) % items.length)} aria-label="Annonce suivante">
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="ticker-viewport" data-paused={paused || undefined}>
            <div ref={track} className="ticker-track" style={{ animationDuration: `${duration}s` }}>
              <ul className="ticker-list">
                {items.map((e) => (
                  <li key={e.id}>
                    <Item entry={e} />
                  </li>
                ))}
              </ul>
              {/* The second copy closes the loop seamlessly; hidden from
                  assistive technologies and from the keyboard. */}
              <ul className="ticker-list" aria-hidden inert>
                {items.map((e) => (
                  <li key={e.id}>
                    <Item entry={e} tabbable={false} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <button type="button" className="ticker-btn mr-1.5" onClick={() => setPaused((p) => !p)} aria-pressed={paused} aria-label="Mettre en pause le défilement des annonces">
            {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
          </button>
        </>
      )}
    </section>
  );
}
