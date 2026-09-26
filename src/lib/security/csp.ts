// Content Security Policy of Classéo. Pure, tested in csp.test.ts; used by
// next.config.ts (the baseline policy on every response) and by
// src/proxy.ts (the strict policy on every page).
//
// Two policies, both sent on pages:
// - the baseline, enforced everywhere: same origin only, no framing, no
//   plugin. It still allows inline script, which the pages rendered ahead
//   of time (the offline page) need.
// - the strict policy, with a fresh nonce per page and 'strict-dynamic': no
//   inline script runs without the nonce (Next.js puts it on its own
//   scripts), except the pre paint preferences script, allowed by its hash.
//   Sent as Content-Security-Policy-Report-Only by default, so a violation
//   is reported to /api/csp-report and nothing breaks; CSP_STRICT=enforce
//   enforces it once the reports are clean. A browser applies every
//   enforced policy, so the strict one then governs.

import { createHash } from "node:crypto";

// Applied before the first paint so the chosen theme, contrast and text size
// never flash. Values come from this device only. Its hash is in the strict
// policy: any change here changes the hash automatically.
export const PREFERENCES_SCRIPT = `(function(){try{var d=document.documentElement,s=localStorage;var t=s.getItem("classeo:theme")||"system";if(t==="system"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}d.dataset.theme=t;d.dataset.contrast=s.getItem("classeo:contrast")||"normal";d.dataset.text=s.getItem("classeo:text")||"md";d.dataset.lite=s.getItem("classeo:lite")||"off"}catch(e){}})();`;

export const PREFERENCES_HASH = `'sha256-${createHash("sha256").update(PREFERENCES_SCRIPT, "utf8").digest("base64")}'`;

export const CSP_REPORT_PATH = "/api/csp-report";

// Google Analytics, only when NEXT_PUBLIC_GA_ID is set (features/analytics).
const GA_SCRIPT = ["https://www.googletagmanager.com"];
const GA_CONNECT = ["https://*.google-analytics.com", "https://*.analytics.google.com", "https://*.googletagmanager.com"];

export type CspOptions = { dev: boolean; httpsOnly: boolean; analytics: boolean };

function common(o: CspOptions) {
  return [
    "default-src 'self'",
    // Inline style attributes are used by React components (bars, charts);
    // styles cannot run code.
    "style-src 'self' 'unsafe-inline'",
    // Media and images from https sources: teachers link hosted audio, video
    // and pictures.
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    `connect-src 'self'${o.analytics ? ` ${GA_CONNECT.join(" ")}` : ""}`,
    "media-src 'self' data: blob: https:",
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    ...(o.httpsOnly ? ["upgrade-insecure-requests"] : []),
  ];
}

export function baselinePolicy(o: CspOptions) {
  const script = `script-src 'self' 'unsafe-inline'${o.dev ? " 'unsafe-eval'" : ""}${o.analytics ? ` ${GA_SCRIPT.join(" ")}` : ""}`;
  return [common(o)[0], script, ...common(o).slice(1)].join("; ");
}

export function strictPolicy(o: CspOptions & { nonce: string }) {
  // 'strict-dynamic': scripts loaded by a trusted script are trusted, host
  // lists are ignored by the browsers that support it; 'self' stays for the
  // older ones. React needs eval only in development.
  const script = `script-src 'self' 'nonce-${o.nonce}' 'strict-dynamic' ${PREFERENCES_HASH}${o.dev ? " 'unsafe-eval'" : ""}${o.analytics ? ` ${GA_SCRIPT.join(" ")}` : ""}`;
  return [common(o)[0], script, ...common(o).slice(1), `report-uri ${CSP_REPORT_PATH}`].join("; ");
}

// 128 random bits, base64.
export function newNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function strictHeaderName(env: Record<string, string | undefined>) {
  return env.CSP_STRICT === "enforce" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";
}
