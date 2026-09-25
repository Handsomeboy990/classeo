"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

// Keeps the newest message in view when the thread opens and when a new
// message arrives.
export function ThreadScroller({ count, children, className }: { count: number; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);
  return (
    // Focusable so keyboard users can scroll the thread with the arrow keys.
    // Positioned, so the visually hidden labels of the listen buttons stay
    // inside it instead of lengthening the page.
    <div ref={ref} tabIndex={0} role="region" aria-label="Fil de la conversation" className={cn("relative max-h-[60vh] overflow-y-auto overscroll-contain rounded-t-card px-4 py-4 sm:px-5", className)}>
      {children}
    </div>
  );
}
