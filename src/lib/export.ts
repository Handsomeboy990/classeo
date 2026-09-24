import "server-only";

import { authorize } from "@/lib/auth/authorize";
import type { PermissionCode } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

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
