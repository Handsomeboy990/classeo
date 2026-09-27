"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { normalisePath, optedOut } from "./visits";

type PrivacyNavigator = Navigator & { globalPrivacyControl?: boolean };

// The page view beacon of the root layout: one small POST per page shown,
// with the page (identifiers replaced by [id]), the host the visitor came
// from on the first page, and the language of the page. No cookie, no
// identifier, nothing stored on the device. Nothing is sent when the
// browser asks not to be followed (Do Not Track, Global Privacy Control).
// The server decides the rest (app/api/stats/visite).
export function VisitBeacon() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    const nav = navigator as PrivacyNavigator;
    if (optedOut(nav, window as unknown as { doNotTrack?: string | null })) return;
    const path = normalisePath(pathname);
    if (!path) return;
    // After the page has settled: the translation layer sets the language
    // of the content, a public page carries it in ?lang=.
    const timer = window.setTimeout(() => {
      const lang = new URLSearchParams(window.location.search).get("lang") ?? document.getElementById("page-content")?.getAttribute("lang") ?? document.documentElement.lang ?? "fr";
      const body = JSON.stringify({ path, lang, ...(first.current && document.referrer ? { referrer: document.referrer } : {}) });
      first.current = false;
      const blob = new Blob([body], { type: "application/json" });
      if (!navigator.sendBeacon?.("/api/stats/visite", blob)) {
        void fetch("/api/stats/visite", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true, credentials: "same-origin" }).catch(() => undefined);
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
