import "server-only";

import { createHash } from "node:crypto";

import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";

// Uploaded files (photos, logos, signatures, stamps, requested documents,
// payment proofs) are small and stored in the database: no third party
// storage to configure, and every read goes through an authorization check.

// "tts_audio": speech produced by the translation service (local
// languages) or by Kora's Piper voice (French), cached by text and voice; never
// uploaded by a user.
// "voice_note": a recording sent in a conversation (WebM or Ogg Opus from
// Chrome, Android and Firefox, MP4 AAC from Safari).
// "family_document": a piece a family sends to the school (enrollment piece,
// absence justification, medical certificate).
export type FilePurpose = "student_photo" | "school_logo" | "signature" | "stamp" | "document" | "payment_proof" | "tts_audio" | "voice_note" | "family_document";

const LIMITS: Record<FilePurpose, { maxBytes: number; types: string[] }> = {
  student_photo: { maxBytes: 1_000_000, types: ["image/jpeg", "image/png", "image/webp"] },
  school_logo: { maxBytes: 1_000_000, types: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"] },
  signature: { maxBytes: 500_000, types: ["image/png", "image/webp"] },
  stamp: { maxBytes: 800_000, types: ["image/png", "image/webp"] },
  document: { maxBytes: 5_000_000, types: ["application/pdf", "image/jpeg", "image/png"] },
  payment_proof: { maxBytes: 2_000_000, types: ["application/pdf", "image/jpeg", "image/png", "image/webp"] },
  tts_audio: { maxBytes: 4_000_000, types: ["audio/wav", "audio/mpeg"] },
  // Two minutes of speech: about 0.5 MB in Opus, 1 MB in AAC. WAV, which
  // every browser plays, is what the demonstration data holds.
  voice_note: { maxBytes: 2_000_000, types: ["audio/webm", "audio/ogg", "audio/mp4", "audio/wav"] },
  // A phone photo is resized in the browser first; a scanned PDF may be
  // heavier.
  family_document: { maxBytes: 3_000_000, types: ["application/pdf", "image/jpeg", "image/png", "image/webp"] },
};

export const VOICE_NOTE_MAX_BYTES = LIMITS.voice_note.maxBytes;
export const FAMILY_DOCUMENT_MAX_BYTES = LIMITS.family_document.maxBytes;

const ascii = (bytes: Uint8Array, from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));

// ISO base media (MP4) major brands a recorder writes for audio: Safari's
// MediaRecorder, voice memos, AAC files.
const MP4_BRANDS = ["M4A ", "M4B ", "mp41", "mp42", "isom", "iso2", "iso4", "iso5", "iso6", "dash", "3gp4", "3gp5"];

// "950 Ko", "2 Mo", "1,5 Mo".
export function sizeLabel(bytes: number) {
  return bytes >= 1_000_000 ? `${String(Math.round(bytes / 100_000) / 10).replace(".", ",")} Mo` : `${Math.max(1, Math.round(bytes / 1000))} Ko`;
}

// Content sniffing: the declared type must match the first bytes, so a
// script renamed ".png" is refused.
function sniff(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return "image/webp";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x41 && b[10] === 0x56 && b[11] === 0x45) return "audio/wav";
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  // WebM: an EBML header whose document type is "webm" (another Matroska
  // document type is refused).
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return ascii(b, 4, 64).includes("webm") ? "audio/webm" : null;
  if (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return "audio/ogg";
  // MP4: a first "ftyp" box with a known major brand.
  if (b.length >= 12 && ascii(b, 4, 8) === "ftyp") return MP4_BRANDS.includes(ascii(b, 8, 12)) ? "audio/mp4" : null;
  // MP3: an ID3 tag, or straight away an MPEG audio frame (11 bits of sync,
  // a valid layer, a bitrate index other than "bad"), as speech services
  // send.
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return "audio/mpeg";
  if (b[0] === 0xff && b[1] !== undefined && b[2] !== undefined && (b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) !== 0 && (b[2] & 0xf0) !== 0xf0) return "audio/mpeg";
  const head = new TextDecoder().decode(b.slice(0, 256)).trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "image/svg+xml";
  return null;
}

export function validateUpload(purpose: FilePurpose, file: { size: number; type: string }, bytes: Uint8Array) {
  const limit = LIMITS[purpose];
  if (file.size === 0) throw new DomainError("Le fichier est vide.");
  if (file.size > limit.maxBytes || bytes.byteLength > limit.maxBytes) throw new DomainError(`Fichier trop lourd : ${sizeLabel(limit.maxBytes)} au maximum.`);
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
