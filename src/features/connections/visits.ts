// Rules of the first party, cookieless page view count. Pure: shared by the
// beacon in the browser and the route that records it (which applies them
// again, never trusting the browser). Tested in connections.test.ts.

export const MAX_PATH_LENGTH = 200;
const MAX_SEGMENTS = 8;

// A segment of an address that names a page ("espace", "pieces-familles")
// is kept; anything else (an identifier, a code, the token of the demo
// page, a name) becomes [id]. Page segments of Classéo are short lower case
// words joined by hyphens; the segment after /acces is always the token.
const PAGE_SEGMENT = /^[a-z]{1,16}(?:-[a-z]{1,16})*$/;

export function normalisePath(input: string | null | undefined): string | null {
  if (typeof input !== "string" || !input.startsWith("/") || input.startsWith("//")) return null;
  const path = input.split(/[?#]/)[0]!.slice(0, 1000);
  const segments = path.split("/").filter(Boolean).slice(0, MAX_SEGMENTS);
  const out = segments.map((s, i) => {
    if (i === 1 && segments[0] === "acces") return "[id]";
    let decoded = s;
    try {
      decoded = decodeURIComponent(s);
    } catch {
      return "[id]";
    }
    return decoded.length <= 40 && PAGE_SEGMENT.test(decoded) ? decoded : "[id]";
  });
  return `/${out.join("/")}`.slice(0, MAX_PATH_LENGTH);
}

// Public pages, counted apart from the signed in space.
export function isPrivatePath(path: string) {
  return path === "/espace" || path.startsWith("/espace/") || path === "/changer-mot-de-passe";
}

// Only the host of the page the visitor came from, never the address (it
// may hold a search or a token), and nothing for Classéo itself.
export function referrerHost(referrer: string | null | undefined, ownHost?: string | null): string | null {
  if (!referrer || typeof referrer !== "string" || referrer.length > 2000) return null;
  let host: string;
  try {
    const url = new URL(referrer);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    host = url.hostname.toLowerCase();
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "");
  if (!/^[a-z0-9.-]{1,100}$/.test(host) || !host.includes(".")) return null;
  if (ownHost && host === ownHost.toLowerCase().replace(/^www\./, "").replace(/:\d+$/, "")) return null;
  return host;
}

// Languages of the interface; anything else is counted as "other".
export const VISIT_LANGUAGES = ["fr", "fon", "yo", "ha"] as const;
export type VisitLanguage = (typeof VISIT_LANGUAGES)[number] | "other";

export function visitLanguage(value: unknown): VisitLanguage {
  if (typeof value !== "string") return "fr";
  const v = value.toLowerCase().slice(0, 8);
  return (VISIT_LANGUAGES as readonly string[]).includes(v) ? (v as VisitLanguage) : "other";
}

export const LANGUAGE_LABELS: Record<VisitLanguage, string> = { fr: "Français", fon: "Fongbe", yo: "Yoruba", ha: "Haoussa", other: "Autre" };

// The browser says it does not want to be followed: Do Not Track or Global
// Privacy Control. The beacon then sends nothing.
export function optedOut(nav: { doNotTrack?: string | null; globalPrivacyControl?: boolean } | undefined, win?: { doNotTrack?: string | null }) {
  if (!nav) return true;
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1" || nav.doNotTrack === "yes" || win?.doNotTrack === "1";
}

// Dimensions of the daily counts (model PageViewDaily).
export type VisitDimension = "path" | "audience" | "referrer" | "language" | "device" | "role";

export type Visit = { path: string; signedIn: boolean; role: string | null; device: string; language: VisitLanguage; referrer: string | null };

// The rows a page view adds one to: a visit never becomes a row of its own.
export function visitCounters(v: Visit): { dimension: VisitDimension; key: string }[] {
  return [
    { dimension: "path", key: v.path },
    { dimension: "audience", key: v.signedIn ? "signed_in" : "public" },
    { dimension: "referrer", key: v.referrer ?? "(direct)" },
    { dimension: "language", key: v.language },
    { dimension: "device", key: v.device },
    // No account identifier, ever; the role only for signed in visitors.
    { dimension: "role", key: v.signedIn && v.role ? v.role : "anonymous" },
  ];
}
