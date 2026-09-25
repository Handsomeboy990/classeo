import "server-only";

import { createHash } from "node:crypto";

import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";

// Uploaded files (photos, logos, signatures, stamps, requested documents,
// payment proofs) are small and stored in the database: no third party
// storage to configure, and every read goes through an authorization check.

export type FilePurpose = "student_photo" | "school_logo" | "signature" | "stamp" | "document" | "payment_proof";

const LIMITS: Record<FilePurpose, { maxBytes: number; types: string[] }> = {
  student_photo: { maxBytes: 1_000_000, types: ["image/jpeg", "image/png", "image/webp"] },
  school_logo: { maxBytes: 1_000_000, types: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"] },
  signature: { maxBytes: 500_000, types: ["image/png", "image/webp"] },
  stamp: { maxBytes: 800_000, types: ["image/png", "image/webp"] },
  document: { maxBytes: 5_000_000, types: ["application/pdf", "image/jpeg", "image/png"] },
  payment_proof: { maxBytes: 2_000_000, types: ["application/pdf", "image/jpeg", "image/png", "image/webp"] },
};

// Content sniffing: the declared type must match the first bytes, so a
// script renamed ".png" is refused.
function sniff(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return "image/webp";
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  const head = new TextDecoder().decode(b.slice(0, 256)).trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "image/svg+xml";
  return null;
}

export function validateUpload(purpose: FilePurpose, file: { size: number; type: string }, bytes: Uint8Array) {
  const limit = LIMITS[purpose];
  if (file.size === 0) throw new DomainError("Le fichier est vide.");
  if (file.size > limit.maxBytes) throw new DomainError(`Fichier trop lourd : ${Math.round(limit.maxBytes / 1000)} Ko au maximum.`);
  const real = sniff(bytes);
  if (!real || !limit.types.includes(real)) throw new DomainError("Format de fichier non accepté.");
  if (real === "image/svg+xml") {
    const text = new TextDecoder().decode(bytes).toLowerCase();
    // An SVG logo may not carry scripts or external references.
    if (/<script|on[a-z]+\s*=|javascript:|<foreignobject|xlink:href\s*=\s*["']?https?:/.test(text)) throw new DomainError("Ce fichier SVG contient du code et ne peut pas être utilisé.");
  }
  return real;
}

// Saves an uploaded File from a form. Returns the new file id.
export async function saveUpload(user: NonNullable<CurrentUser>, purpose: FilePurpose, file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = validateUpload(purpose, file, bytes);
  const created = await db.fileBlob.create({
    data: {
      ownerUserId: user.id,
      purpose,
      fileName: file.name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120) || "fichier",
      mimeType,
      size: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      data: Buffer.from(bytes),
    },
    select: { id: true },
  });
  return created.id;
}

export function fileUrl(fileId: string | null | undefined) {
  return fileId ? `/api/files/${fileId}` : null;
}

// Raw bytes for server side rendering (PDF documents). Callers are server
// code that already authorized the document.
export async function readFileBytes(fileId: string | null | undefined) {
  if (!fileId) return null;
  const f = await db.fileBlob.findUnique({ where: { id: fileId }, select: { data: true, mimeType: true } });
  return f ? { data: Buffer.from(f.data), mimeType: f.mimeType } : null;
}
