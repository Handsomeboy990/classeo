import "server-only";

import { authorize } from "@/lib/auth/authorize";
import type { PermissionCode } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { hitRateLimit } from "@/lib/rate-limit";

function escapeCsv(value: unknown) {
  const s = value === null || value === undefined ? "" : String(value);
  // Neutralise spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

// Shared CSV export for route handlers: permission check, audit entry, BOM so
// Excel opens accents correctly, semicolon separator (French locale).
export async function exportCsv<T>(options: {
  permission: PermissionCode;
  resource: string;
  filename: string;
  load: (user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) => Promise<T[]>;
  columns: { header: string; value: (row: T) => unknown }[];
}) {
  const user = await getCurrentUser();
  try {
    authorize(user, options.permission);
  } catch {
    return new Response("Accès refusé", { status: 403 });
  }
  // Same rule as the pages and actions: no export under a temporary password.
  if (user.mustChangePassword) return new Response("Accès refusé", { status: 403 });
  // Up to 10 000 rows each: 60 exports per account and 10 minutes.
  const limit = await hitRateLimit(`csv:${user.id}`, 60, 10 * 60 * 1000);
  if (!limit.allowed) {
    return new Response("Trop d'exports demandés. Réessayez dans quelques minutes.", { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)), "Cache-Control": "no-store" } });
  }
  const rows = await options.load(user);
  const lines = [
    options.columns.map((c) => escapeCsv(c.header)).join(";"),
    ...rows.map((r) => options.columns.map((c) => escapeCsv(c.value(r))).join(";")),
  ];
  await audit(user, { action: "export", resource: options.resource, summary: `Export CSV ${options.filename} (${rows.length} lignes)` });
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${options.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
