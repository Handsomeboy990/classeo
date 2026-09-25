// Pure rules of the document register: verification codes, canonical
// content hashing, labels and the minimal details shown publicly. No server
// import, unit tested.

import { createHash, randomInt } from "node:crypto";

import type { PermissionCode } from "@/lib/auth/permissions";

// Crockford base 32: no I, L, O or U, so a code read aloud or typed from
// paper is not mistaken ("0" and "O", "1" and "l").
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

// "K7QD4-M2XPH": 10 random characters, 50 bits. Guessing a valid code is
// hopeless, and the public page is rate limited on top.
export function newVerificationCode(random: (max: number) => number = randomInt) {
  let s = "";
  for (let i = 0; i < 10; i++) s += ALPHABET[random(32)];
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}

// What a visitor types or scans, normalised: case, spaces, and the letters
// Crockford reads as digits. Null when it cannot be a code.
export function normalizeCode(input: string): string | null {
  const raw = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (raw.length !== 10 || [...raw].some((c) => !ALPHABET.includes(c))) return null;
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

// Stable JSON: object keys sorted at every level, dates as ISO strings, so
// the same content always gives the same hash whatever the key order.
export function canonicalJson(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export function sha256(data: string | Uint8Array) {
  return createHash("sha256").update(data).digest("hex");
}

export function contentHash(value: unknown) {
  return sha256(canonicalJson(value));
}

export const DOCUMENT_KINDS = {
  bulletin: "Bulletin de notes",
  attestation: "Attestation de scolarité",
  certificat: "Certificat de scolarité",
  recu: "Reçu de paiement",
  facture: "Facture",
  releve: "Relevé de notes",
  liste: "Liste de classe",
  fiche_appel: "Fiche d'appel",
  emploi_du_temps: "Emploi du temps",
  statistiques: "Statistiques",
  examen_blanc: "Relevé d'examen blanc",
} as const;
export type DocumentKind = keyof typeof DOCUMENT_KINDS;

// Documents a school head can sign electronically.
export const SIGNABLE_KINDS = ["attestation", "bulletin", "certificat"] as const satisfies DocumentKind[];
export type SignableKind = (typeof SIGNABLE_KINDS)[number];

export function isSignable(kind: string): kind is SignableKind {
  return (SIGNABLE_KINDS as readonly string[]).includes(kind);
}

// The permission a staff member needs to revoke an issued document of a
// kind: the right that governs the data it certifies.
export const REVOKE_PERMISSION: Record<DocumentKind, PermissionCode> = {
  bulletin: "report_card:publish",
  attestation: "student:update",
  certificat: "student:update",
  releve: "report_card:publish",
  recu: "payment:delete",
  facture: "fee:update",
  liste: "class:update",
  fiche_appel: "attendance:update",
  emploi_du_temps: "timetable:update",
  statistiques: "statistics:export",
};

// "Afiavi Sènami Hounkpatin" gives "A. S. H.": enough to match the paper in
// hand, not enough to identify a child from a guessed code.
export function initials(...names: (string | null | undefined)[]) {
  return names
    .filter((n): n is string => !!n)
    .flatMap((n) => n.split(/[\s-]+/))
    .filter(Boolean)
    .map((p) => `${p.charAt(0).toLocaleUpperCase("fr-FR")}.`)
    .join(" ");
}

export type VerificationStatus = "valid" | "revoked" | "unknown";

export function statusOf(doc: { revokedAt: Date | null } | null, signature?: { revokedAt: Date | null } | null): VerificationStatus {
  if (!doc) return "unknown";
  if (doc.revokedAt || signature?.revokedAt) return "revoked";
  return "valid";
}

// "classeo.bj/verifier/K7QD4-M2XPH", printed under the QR code: the scheme
// is left out on paper, the QR code carries the full address.
export function verificationUrl(base: string, code: string) {
  return `${base.replace(/\/+$/, "")}/verifier/${code}`;
}

export function shortUrl(url: string) {
  return url.replace(/^https?:\/\//, "");
}
