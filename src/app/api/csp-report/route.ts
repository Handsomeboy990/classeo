import { headers } from "next/headers";

import { clientIp } from "@/lib/auth/session";
import { hitRateLimit } from "@/lib/rate-limit";

// Violations of the strict Content Security Policy (lib/security/csp.ts),
// sent by browsers while it is report only. Logged in a short form (the
// directive, the page path, the host of what was blocked): never the full
// addresses, which may carry identifiers or a token. Answers 204 whatever
// happens, and 429 past a per address limit.

const MAX_BYTES = 8_000;

function hostOf(value: unknown) {
  if (typeof value !== "string") return null;
  if (["inline", "eval", "self", "data", "blob"].includes(value)) return value;
  return URL.parse(value)?.host ?? null;
}

function pathOf(value: unknown) {
  if (typeof value !== "string") return null;
  return URL.parse(value)?.pathname.replace(/\/[^/]*\d[^/]*/g, "/[id]").slice(0, 120) ?? null;
}

export async function POST(request: Request) {
  const ip = clientIp(await headers());
  const limit = await hitRateLimit(`csp-report:${ip}`, ip === "direct" ? 600 : 60, 60_000);
  if (!limit.allowed) return new Response(null, { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } });
  const raw = await request.text().catch(() => "");
  if (!raw || raw.length > MAX_BYTES) return new Response(null, { status: 204 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 204 });
  }
  // report-uri sends { "csp-report": {...} }; the Reporting API an array of
  // { type, body }.
  const reports = Array.isArray(body) ? body.map((r) => (r as { body?: unknown })?.body) : [(body as { "csp-report"?: unknown })?.["csp-report"]];
  for (const r of reports.slice(0, 5)) {
    if (!r || typeof r !== "object") continue;
    const report = r as Record<string, unknown>;
    console.warn("csp violation", {
      directive: String(report["effective-directive"] ?? report.effectiveDirective ?? report["violated-directive"] ?? "").slice(0, 40),
      page: pathOf(report["document-uri"] ?? report.documentURL),
      blocked: hostOf(report["blocked-uri"] ?? report.blockedURL),
      mode: String(report.disposition ?? "").slice(0, 10),
    });
  }
  return new Response(null, { status: 204 });
}
