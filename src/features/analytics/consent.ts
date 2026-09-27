// Rules of the optional Google Analytics (NEXT_PUBLIC_GA_ID). Pure, tested
// in consent.test.ts.
//
// Nothing of Google is loaded, and no cookie set, before the visitor
// accepts; the choice stays on the device (localStorage), never in a
// cookie. Never on the signed in space, never when the browser asks not to
// be followed (Do Not Track, Global Privacy Control). The page sent to
// Google has its identifiers replaced by [id] and no query.

import { normalisePath, optedOut } from "@/features/connections/visits";

export const CONSENT_KEY = "classeo:analytics-consent";
export type Consent = "granted" | "denied";

// A measurement id looks like G-XXXXXXX.
export function validGaId(id: string | undefined | null): string | null {
  return id && /^G-[A-Z0-9]{4,20}$/.test(id.trim()) ? id.trim() : null;
}

export function readConsent(storage: Pick<Storage, "getItem"> | null | undefined): Consent | null {
  try {
    const v = storage?.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function isPrivatePage(pathname: string) {
  return pathname === "/espace" || pathname.startsWith("/espace/") || pathname.startsWith("/acces/") || pathname === "/changer-mot-de-passe";
}

type Nav = { doNotTrack?: string | null; globalPrivacyControl?: boolean };

// Whether the banner may show at all on this page for this browser.
export function mayAsk(o: { gaId: string | null; pathname: string; nav: Nav | undefined }) {
  return !!o.gaId && !isPrivatePage(o.pathname) && !optedOut(o.nav);
}

// Whether Google Analytics may load now.
export function mayLoad(o: { gaId: string | null; pathname: string; nav: Nav | undefined; consent: Consent | null }) {
  return mayAsk(o) && o.consent === "granted";
}

// The page as Google sees it: /verifier/K7QD4-M2XPH becomes /verifier/[id].
export function gaPagePath(pathname: string) {
  return normalisePath(pathname) ?? "/";
}

// Names of the cookies Google Analytics sets, removed when the visitor
// withdraws consent.
export function gaCookieNames(cookieHeader: string) {
  return cookieHeader
    .split(/;\s*/)
    .map((c) => c.split("=")[0]!)
    .filter((name) => name === "_ga" || name.startsWith("_ga_") || name === "_gid");
}
