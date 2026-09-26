import "server-only";

import type { ReactElement } from "react";

import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";

import { recordIssued, signedIssuance, verificationOf } from "@/features/verification/registry";
import { contentHash, newVerificationCode, sha256, type DocumentKind } from "@/features/verification/reference";
import { audit } from "@/lib/audit";
import { ForbiddenError } from "@/lib/auth/authorize";
import type { PermissionCode } from "@/lib/auth/permissions";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { hitRateLimit } from "@/lib/rate-limit";

import { withDocumentScope, type DocumentSigned } from "./context";
import { completeIssuer } from "./data/letterhead";
import { prepareFonts } from "./fonts";
import { attachmentHeader } from "./format";
import type { DocumentMeta, Issuer } from "./layout";

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
  // Entry of the register of issued documents (the public check page).
  kind: DocumentKind;
  title: string;
  // Student, report card, payment, invoice, class... the document is about.
  subjectId?: string | null;
  // A document the head can sign: its content, hashed. When a signature of
  // the same content exists, the copy carries it and its stable code.
  signable?: { content: unknown };
};

const refused = () => new Response("Accès refusé", { status: 403, headers: { "Cache-Control": "no-store" } });
const missing = () => new Response("Document introuvable", { status: 404, headers: { "Cache-Control": "no-store" } });
const tooMany = (retryAfterMs: number) =>
  new Response("Trop de documents demandés. Réessayez dans quelques minutes.", { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } });

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
  // Rendering is the most expensive work of the platform: 120 documents per
  // account and 10 minutes covers a whole class printed one by one.
  const limit = await hitRateLimit(`pdf:${user.id}`, 120, 10 * 60 * 1000);
  if (!limit.allowed) return tooMany(limit.retryAfterMs);

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
  // Every school document carries the full letterhead (ministry, logo).
  if (data && typeof data === "object" && "issuer" in data) {
    const holder = data as { issuer: Issuer };
    holder.issuer = await completeIssuer(holder.issuer);
  }
  const built = await options.build(data, ctx);
  await prepareFonts();

  // A signed copy reuses the code of its signature; any other copy gets a
  // code of its own, printed with its QR code and registered with the hash
  // of the exact file sent.
  const subjectId = built.subjectId ?? built.resourceId ?? null;
  const signed = built.signable && subjectId ? await signedIssuance(built.kind, subjectId, contentHash(built.signable.content)) : null;
  const render = (code: string, signedBy: DocumentSigned | null) => withDocumentScope({ verification: verificationOf(code), signed: signedBy }, () => renderToBuffer(built.element));

  let code = signed?.code ?? newVerificationCode();
  let buffer = await render(code, signed?.signed ?? null);
  if (!signed) {
    // A code drawn twice (about one chance in 10^15) is drawn again and the
    // file rendered with the new one.
    for (let attempt = 0; ; attempt++) {
      const entry = { kind: built.kind, title: built.title, subjectId, schoolId: built.schoolId ?? null, contentHash: sha256(buffer), issuedById: user.id };
      if (await recordIssued(code, entry)) break;
      if (attempt >= 3) throw new Error("could not draw a free verification code");
      code = newVerificationCode();
      buffer = await render(code, null);
    }
  }

  await audit(user, {
    action: "export",
    resource: options.resource,
    resourceId: built.resourceId ?? null,
    summary: `Export PDF ${built.fileName}, réf. ${built.reference}, code de vérification ${code}${signed ? " (signé)" : ""} : ${built.summary}`,
    metadata: { format: "pdf", reference: built.reference, fileName: built.fileName, verificationCode: code, signed: !!signed },
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
