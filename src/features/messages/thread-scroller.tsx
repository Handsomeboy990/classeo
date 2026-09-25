"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Keeps the newest message in view when the thread opens and when a new
// message arrives.
export function ThreadScroller({ count, children }: { count: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);
  return (
    // Focusable so keyboard users can scroll the thread with the arrow keys.
    <div ref={ref} tabIndex={0} role="region" aria-label="Fil de la conversation" className="max-h-[60vh] overflow-y-auto rounded-t-card px-4 py-4 sm:px-5">

      {children}
    </div>
  );
}
