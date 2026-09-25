// Pure text rules of the translation layer, shared by the browser layer, the
// server routes and the pre-translation script.

// The form a string is cached under: spaces collapsed, ends trimmed. The
// same text rendered with different indentation hits the same entry.
export function normalise(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export const MAX_UI_LENGTH = 300;

const LETTER = /\p{L}/u;
const DIGIT = /\p{N}/u;
const EMAIL_OR_URL = /@|https?:|www\.|\.(?:fr|bj|com|org)\b/i;
// A person or a school: every word starts with a capital, as in
// "Sènami Hounkpatin" or "CEG Akpakpa Centre".
const PROPER_NAME = /^(?:[\p{Lu}][\p{L}'’-]*)(?:\s+(?:[\p{Lu}][\p{L}'’.-]*|de|du|des|d'|la|le))*$/u;

// Whether a text node is worth looking up at all. Numbers, grades, dates,
// amounts, initials and identifiers are left as they are.
export function isCandidate(text: string) {
  if (text.length < 2 || text.length > MAX_UI_LENGTH) return false;
  if (!LETTER.test(text)) return false;
  if (EMAIL_OR_URL.test(text)) return false;
  // "3e A", "T1", "13,5/20", "12 000 FCFA": mostly figures.
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  const digits = (text.match(/\p{N}/gu) ?? []).length;
  if (digits > 0 && (letters < 4 || letters <= digits)) return false;
  // Initials of an avatar, an abbreviation such as "CEG".
  if (/^[\p{Lu}.]{1,4}$/u.test(text)) return false;
  return true;
}

// Whether a string missing from the cache may be sent to the translation
// service in the background. Stricter than isCandidate: anything that may be
// a name, or carries a figure (a date, a grade, an amount), stays French
// unless it was pre-translated from the source code.
export function isQueueable(text: string) {
  // Interface labels are short; a longer text is content (a message, an
  // announcement), translated only when a person asks for it.
  if (!isCandidate(text) || text.length > 80) return false;
  if (DIGIT.test(text)) return false;
  if (PROPER_NAME.test(text)) return false;
  return text.split(" ").length >= 2 || /^[\p{Ll}]/u.test(text);
}

function digitsOf(text: string) {
  return (text.match(/\p{N}+/gu) ?? []).join(" ");
}

// A translation is kept only when it is usable: not empty, not absurdly
// long, and with the same figures as the source (a grade or a date must
// never change in translation). Its first letter follows the source's case.
export function polish(source: string, translated: unknown): string | null {
  if (typeof translated !== "string") return null;
  // The model sometimes leaves a space before a full stop or a comma.
  let t = normalise(translated).replace(/\s+([.,])(?=\s|$)/g, "$1");
  if (!t || t.length > source.length * 4 + 40) return null;
  if (digitsOf(t) !== digitsOf(source)) return null;
  const first = source.charAt(0);
  if (first !== first.toLowerCase()) t = t.charAt(0).toUpperCase() + t.slice(1);
  return t;
}

// Splits a list into batches of at most `size` items, after removing
// duplicates.
export function batches<T>(items: readonly T[], size = 100): T[][] {
  const unique = [...new Set(items)];
  const out: T[][] = [];
  for (let i = 0; i < unique.length; i += size) out.push(unique.slice(i, i + size));
  return out;
}

// A long text (an announcement, a message) is translated paragraph by
// paragraph and, inside a long paragraph, sentence by sentence: short
// segments translate better and are reused across texts.
export function segments(text: string, max = 400): string[] {
  const out: string[] = [];
  for (const paragraph of text.split(/\n\s*\n|\n/)) {
    const p = normalise(paragraph);
    if (!p) continue;
    if (p.length <= max) {
      out.push(p);
      continue;
    }
    let current = "";
    for (const sentence of p.split(/(?<=[.!?;:])\s+/u)) {
      if (current && (current + " " + sentence).length > max) {
        out.push(current);
        current = sentence;
      } else current = current ? `${current} ${sentence}` : sentence;
    }
    if (current) out.push(current.slice(0, max * 2));
  }
  return out;
}

// Groups translated sentences into pieces the speech service accepts (1000
// characters at most), cutting between sentences.
export function speechChunks(text: string, max = 1000): string[] {
  const out: string[] = [];
  let current = "";
  for (const sentence of normalise(text).split(/(?<=[.!?;])\s+/u)) {
    const s = sentence.length > max ? sentence.slice(0, max) : sentence;
    if (current && (current + " " + s).length > max) {
      out.push(current);
      current = s;
    } else current = current ? `${current} ${s}` : s;
  }
  if (current) out.push(current);
  return out;
}
