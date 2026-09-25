import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { readFileBytes } from "@/lib/files";
import { appUrl } from "@/lib/mail/config";
import type { DocumentSigned, DocumentVerification, PdfImage } from "@/lib/pdf/context";
import { pdfImageFormat } from "@/lib/pdf/letterhead";
import { encodeQr } from "@/lib/qr";

import { newVerificationCode, shortUrl, verificationUrl, type DocumentKind } from "./reference";

// The register of every document the platform issues. Each PDF download and
// each printed view gets a verification code, printed with its QR code; the
// public page /verifier/<code> reads this register.

export function verificationOf(code: string): DocumentVerification {
  const url = verificationUrl(appUrl(process.env), code);
  return { code, url, shortUrl: shortUrl(url), qr: encodeQr(url) };
}

export type IssueInput = {
  kind: DocumentKind;
  title: string;
  subjectId?: string | null;
  schoolId?: string | null;
  contentHash: string;
  issuedById: string;
  signatureId?: string | null;
};

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// Records an issued document under a given code (already printed on it).
// Returns false when the code is taken, so the caller draws another one.
export async function recordIssued(code: string, input: IssueInput) {
  try {
    await db.issuedDocument.create({ data: { reference: code, ...input, subjectId: input.subjectId ?? null, schoolId: input.schoolId ?? null } });
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

export async function issueDocument(input: IssueInput) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newVerificationCode();
    if (await recordIssued(code, input)) return code;
  }
  throw new Error("could not draw a free verification code");
}

// A printed view shown again the same day by the same person, with the same
// content, keeps its code: reloading a page does not fill the register.
export async function issueOnce(input: IssueInput) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existing = await db.issuedDocument.findFirst({
    where: { kind: input.kind, subjectId: input.subjectId ?? null, contentHash: input.contentHash, issuedById: input.issuedById, revokedAt: null, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: { reference: true },
  });
  return existing?.reference ?? issueDocument(input);
}

async function image(fileId: string | null | undefined): Promise<PdfImage | null> {
  const file = await readFileBytes(fileId);
  const format = file ? pdfImageFormat(file.mimeType) : null;
  return file && format ? { data: file.data, format } : null;
}

// The signed issuance of a document whose content has not changed since the
// head signed it: its code (stable, printed on every copy) and the signer's
// images. Null when the document is not signed, the signature was revoked,
// or the content changed (a new grade, a corrected name): the copy is then
// issued unsigned until the head signs again.
export async function signedIssuance(kind: DocumentKind, subjectId: string, hash: string): Promise<{ code: string; signed: DocumentSigned } | null> {
  const sig = await db.documentSignature.findFirst({
    where: { kind, subjectId, contentHash: hash, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      reference: true,
      createdAt: true,
      signedBy: { select: { firstName: true, lastName: true, gender: true, role: { select: { name: true } }, signature: { select: { signatureFileId: true, stampFileId: true } } } },
    },
  });
  if (!sig) return null;
  const issued = await db.issuedDocument.findFirst({ where: { signatureId: sig.id, revokedAt: null }, select: { reference: true } });
  if (!issued) return null;
  const s = sig.signedBy;
  const [signature, stamp] = await Promise.all([image(s.signature?.signatureFileId), image(s.signature?.stampFileId)]);
  return { code: issued.reference, signed: { name: `${s.firstName} ${s.lastName}`, role: s.role.name, signedAt: sig.createdAt, signature, stamp } };
}
