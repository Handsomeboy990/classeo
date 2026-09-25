import "server-only";

import type { ReactElement } from "react";

import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";

import { audit } from "@/lib/audit";
import { ForbiddenError } from "@/lib/auth/authorize";
import type { PermissionCode } from "@/lib/auth/permissions";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";

import { prepareFonts } from "./fonts";
import { attachmentHeader } from "./format";
import type { DocumentMeta } from "./layout";

export type PdfUser = NonNullable<CurrentUser>;

export type PdfContext = {
  user: PdfUser;
  generatedAt: Date;
  generatedBy: DocumentMeta["generatedBy"];
};

export type BuiltPdf = {
  element: ReactElement<DocumentProps>;
  fileName: string;
  reference: string;
  // Written to the activity log, with the reference.
  summary: string;
  resourceId?: string | null;
  schoolId?: string | null;
};

const refused = () => new Response("Accès refusé", { status: 403, headers: { "Cache-Control": "no-store" } });
const missing = () => new Response("Document introuvable", { status: 404, headers: { "Cache-Control": "no-store" } });

// Shared PDF export for route handlers, the twin of exportCsv(): permission
// check, no download under a temporary password, data loaded through the
// scope filters by the caller (null means outside the scope or unknown, both
// answered 404), audit entry with the document reference, attachment.
export async function exportPdf<D>(options: {
  permission: PermissionCode;
  resource: string;
  load: (user: PdfUser) => Promise<D | null>;
  build: (data: D, ctx: PdfContext) => BuiltPdf | Promise<BuiltPdf>;
}) {
  const user = await getCurrentUser();
  if (!user || !user.permissions.has(options.permission)) return refused();
  if (user.mustChangePassword) return refused();

  let data: D | null;
  try {
    data = await options.load(user);
  } catch (error) {
    if (error instanceof ForbiddenError) return refused();
    throw error;
  }
  if (data === null) return missing();

  const ctx: PdfContext = {
    user,
    generatedAt: new Date(),
    generatedBy: { name: user.fullName, role: user.role.name, email: user.username },
  };
  const built = await options.build(data, ctx);
  await prepareFonts();
  const buffer = await renderToBuffer(built.element);

  await audit(user, {
    action: "export",
    resource: options.resource,
    resourceId: built.resourceId ?? null,
    summary: `Export PDF ${built.fileName}, réf. ${built.reference} : ${built.summary}`,
    metadata: { format: "pdf", reference: built.reference, fileName: built.fileName },
    schoolId: built.schoolId ?? undefined,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": attachmentHeader(built.fileName),
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
    },
  });
}
