// Pure formatting helpers of the PDF documents. No server import: unit
// tested, and shared with the HTML print views.

import { amountInWords } from "@/lib/domain/payments";
import { formatClock, formatFcfa } from "@/lib/utils";

export const BENIN_TIME_ZONE = "Africa/Porto-Novo";

// Intl groups thousands with a narrow no-break space (U+202F), a glyph the
// embedded latin subsets do not carry. The ordinary no-break space keeps the
// figures together on one line and exists in every font.
export function pdfText(value: string): string {
  return value.replace(/\u202f/g, "\u00a0");
}

// The currency stays on the line of its figure.
export function pdfFcfa(amount: number): string {
  return pdfText(formatFcfa(amount)).replace(/ FCFA$/, "\u00a0FCFA");
}

// "Arrêté à la somme de quarante-cinq mille francs CFA": the words come from
// the receipt rule of the payments domain, never recomputed here.
export function amountSentence(amount: number): string {
  return `${amountInWords(amount)} francs CFA`;
}

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: BENIN_TIME_ZONE });
const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: BENIN_TIME_ZONE });
const calendarFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const shortFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const weekdayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// An instant (generation, payment, publication) read in Benin time:
// "25 septembre 2026".
export function beninDate(d: Date): string {
  return pdfText(dateFmt.format(d)).replace(/^1 /, "1er ");
}

// "25 septembre 2026 à 14 h 05", the French typographic form of a time.
export function beninDateTime(d: Date): string {
  return `${beninDate(d)} à ${formatClock(timeFmt.format(d))}`;
}

// A calendar day stored at midnight UTC (birth date, due date, attendance
// day): read in UTC so it never shifts to the previous day.
export function calendarDate(d: Date): string {
  return pdfText(calendarFmt.format(d)).replace(/^1 /, "1er ");
}

export function calendarShort(d: Date): string {
  return shortFmt.format(d);
}

// "Lundi 5 octobre 2026".
export function calendarWeekday(d: Date): string {
  const s = pdfText(weekdayFmt.format(d)).replace(/ 1 /, " 1er ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function pageLabel(page: number, total: number): string {
  return `Page ${page} sur ${total}`;
}

// FNV-1a, 32 bits: a short stable fingerprint of what a document is about.
function fingerprint(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).toUpperCase().padStart(7, "0").slice(-7);
}

// "BUL-20260925-0K4QZ7M": kind, day of generation in Benin time and a
// fingerprint of the subject (the ids of the student, the period...). The
// same document generated twice the same day keeps its reference, which is
// written to the activity log with the account that generated it.
export function documentReference(prefix: string, generatedAt: Date, ...subject: (string | number | null | undefined)[]): string {
  const day = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: BENIN_TIME_ZONE })
    .format(generatedAt)
    .replace(/-/g, "");
  const code = prefix.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4) || "DOC";
  return `${code}-${day}-${fingerprint(subject.map((s) => String(s ?? "")).join("|"))}`;
}

// A file name every system accepts: lower case ASCII, words joined by
// hyphens, accents removed ("Bulletin 1er trimestre, Dossou Afi" gives
// "bulletin-1er-trimestre-dossou-afi.pdf").
export function pdfFileName(...parts: (string | null | undefined)[]): string {
  const slug = parts
    .filter((p): p is string => !!p)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
  return `${slug || "document"}.pdf`;
}

// Attachment header with an ASCII name and its UTF-8 form.
export function attachmentHeader(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

// "Dossou Afi" printed as on official lists: family name in capitals.
export function officialName(lastName: string, firstName: string): string {
  return `${lastName.toLocaleUpperCase("fr-FR")} ${firstName}`;
}

// French ordinal of a rank with its tie marker, written in full: "1er",
// "12e ex æquo".
export function ordinal(rank: number | null, tied = false): string {
  if (rank === null) return "–";
  return `${rank}${rank === 1 ? "er" : "e"}${tied ? " ex æquo" : ""}`;
}

// "2 h 30" for a lesson length in minutes.
export function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}
