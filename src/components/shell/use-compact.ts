"use client";

import { useSyncExternalStore } from "react";

// Below the lg breakpoint (64rem, Tailwind's default) the shell is the phone
// app: tab bar, bottom sheets. Same query as the lg: utilities.
const QUERY = "(max-width: 63.999rem)";

function subscribe(onChange: () => void) {
  const mq = matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function useCompact() {
  return useSyncExternalStore(
    subscribe,
    () => matchMedia(QUERY).matches,
    () => false,
  );
}

export function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
