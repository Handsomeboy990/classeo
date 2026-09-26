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
  // "3e A", "T1", "13,5/20", "12 000 FCFA": mostly figures. A number counts
  // once, whatever its length: "Trimestre 3 2025-2026" and "sur 20" are
  // words with values, looked up as templates.
  const letters = (text.replace(/FCFA/g, "").match(/\p{L}/gu) ?? []).length;
  const numbers = (text.match(/\p{N}+/gu) ?? []).length;
  if (numbers > 0 && (letters < 3 || letters <= numbers)) return false;
  // Initials of an avatar, an abbreviation such as "CEG".
  if (/^[\p{Lu}.]{1,4}$/u.test(text)) return false;
  return true;
}

function splitLabel(text: string) {
  const m = text.match(/^(.+?)(\s*[,:]\s+)(.+)$/u);
  return m ? { head: m[1]!, sep: m[2]!, tail: m[3]! } : null;
}

// Figures, identifiers and names are the values of a template: "3 absences" and "5
// absences" share the cache entry "2 absences", "Bulletin de Sènami" and
// "Bulletin de Koffi" share "Bulletin de 2". Every number but 0 and 1 (which
// carry the grammar of the sentence) and every name of `names` becomes 2, 3,
// 4... in order; the translation gets its values back by slot, whatever
// order the language puts them in. Names never reach the translation
// service this way, and one entry serves every family.
const NUMBER = "\\d+(?:[.,]\\d+)*";
// Identifiers are values too, never words to translate: "FAC-2026-0242",
// "BJ26000242", "K6W9P-5GQMY" (capitals and figures, at least one of each).
const CODE = "(?<![\\p{L}\\p{N}])(?=[A-Z0-9-]*\\d)(?=[A-Z0-9-]*[A-Z][0-9-]*[A-Z])[A-Z0-9][A-Z0-9-]{4,}(?![\\p{L}\\p{N}])";

// The names a page may show (the reader, their children, their schools,
// the teachers they write to), longest first so a full name is one slot.
export function namePattern(names: readonly string[]): RegExp | null {
  const list = [...new Set(names.map(normalise).filter((n) => n.length >= 2 && /\p{L}/u.test(n)))].sort((a, b) => b.length - a.length);
  if (!list.length) return null;
  const escaped = list.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${escaped.join("|")})(?![\\p{L}\\p{N}])`, "u");
}

export function numberTemplate(text: string, names: RegExp | null = null): { key: string; values: Map<string, string> } | null {
  let next = 2;
  const slots = new Map<string, string>();
  const values = new Map<string, string>();
  const pattern = new RegExp(names ? `${names.source}|${CODE}|${NUMBER}` : `${CODE}|${NUMBER}`, "gu");
  const key = text.replace(pattern, (m) => {
    if (m === "0" || m === "1") return m;
    let slot = slots.get(m);
    if (!slot) {
      slot = String(next++);
      slots.set(m, slot);
      values.set(slot, m);
    }
    return slot;
  });
  return values.size ? { key, values } : null;
}

// Bullets, brackets and separators around a fragment: "· publié le",
// "(Enseignante", "Moyenne :", "/ Parcours". The words inside are looked
// up alone.
function affixes(text: string) {
  const m = text.match(/^([\s·•,;:–(/\-]*)(.*?)([\s·•,;:–)/\-]*)$/u);
  return m && (m[1] || m[3]) && m[2] ? { lead: m[1]!, core: m[2]!, trail: m[3]! } : null;
}

// Whether a text node is worth translating: an interface string, or a
// longer text (a paragraph of the guide) made of such sentences.
export function isTranslatable(text: string) {
  if (isCandidate(text)) return true;
  if (text.length <= MAX_UI_LENGTH || !LETTER.test(text)) return false;
  const parts = sentencesOf(text);
  return !!parts && parts.every((p) => p.length <= MAX_UI_LENGTH);
}

// Separate sentences of a longer text, each looked up on its own when the
// whole text is not in the cache: a spoken summary mixes fixed sentences
// with sentences holding names and figures.
function sentencesOf(text: string) {
  const parts = text.split(/(?<=[.!?])\s+(?=\p{Lu}|\p{N})/u);
  return parts.length > 1 ? parts : null;
}

export type LookupOptions = {
  // Translates what the cache cannot hold, such as dates (date-words.ts).
  other?: (text: string) => string | undefined;
  names?: RegExp | null;
};

// The cache entries a text may use: itself, its template, its core without
// bullets, its label when it is "label, value" or "label : value", the
// words before a date ("Publié le" in "Publié le 22 septembre 2026"), its
// sentences.
export function lookupKeys(text: string, dateLabel: (text: string) => { label: string } | null = () => null, names: RegExp | null = null): string[] {
  const keys = new Set([text]);
  const add = (t: string) => {
    keys.add(t);
    const template = numberTemplate(t, names);
    if (template) keys.add(template.key);
  };
  add(text);
  const a = affixes(text);
  if (a) add(a.core);
  const parts = splitLabel(a?.core ?? text);
  if (parts) {
    keys.add(parts.head);
    keys.add(`${parts.head}${parts.sep.trim()}`);
    // "Mention : Passable": the value too, unless it is a name.
    if (!PROPER_NAME.test(parts.tail)) add(parts.tail);
  }
  const dated = dateLabel(a?.core ?? text);
  if (dated) add(dated.label);
  for (const s of sentencesOf(text) ?? []) for (const k of lookupKeys(s, dateLabel, names)) keys.add(k);
  for (const s of listOf(text) ?? []) for (const k of lookupKeys(s, dateLabel, names)) keys.add(k);
  return [...keys].filter((k) => isCandidate(k));
}

// A whole string, or a known label followed by a value it introduces:
// "Bonjour, Afiavi", "Moyenne : 13,5/20". The label is translated, the
// value (a name, a figure) is kept as is.
export function lookupText(text: string, map: Map<string, string>, other: LookupOptions["other"] = () => undefined, names: RegExp | null = null): string | undefined {
  const single = (t: string): string | undefined => {
    const hit = map.get(t) ?? other(t);
    if (hit) return hit;
    const template = numberTemplate(t, names);
    const filled = template && map.get(template.key);
    return filled ? filled.replace(/\d+/g, (m) => template.values.get(m) ?? m) : undefined;
  };
  const whole = single(text);
  if (whole) return whole;
  const a = affixes(text);
  const core = a ? single(a.core) : undefined;
  if (a && core) return `${a.lead}${core}${a.trail}`;
  const parts = splitLabel(a?.core ?? text);
  if (parts) {
    const { head, sep, tail } = parts;
    const label = map.get(head) ?? map.get(`${head}${sep.trim()}`)?.replace(/[,:]$/, "");
    if (label) return `${a?.lead ?? ""}${label}${sep}${single(tail) ?? tail}${a?.trail ?? ""}`;
  }
  const sentences = sentencesOf(text);
  if (sentences) {
    const done = sentences.map((s) => lookupText(s, map, other, names));
    if (done.every(Boolean)) return done.join(" ");
  }
  // "3e · épreuves du 26 octobre au 27 octobre · Direction départementale
  // Atlantique": each part on its own; a part that is a value (a class, a
  // name, a figure) stays as it is.
  const items = listOf(text);
  if (items) {
    const done = items.map((p) => lookupText(p, map, other, names) ?? (isValue(p, names) ? p : undefined));
    if (done.every(Boolean)) return done.join(" · ");
  }
  return undefined;
}

function listOf(text: string) {
  const parts = text.split(" · ");
  return parts.length > 1 && parts.every(Boolean) ? parts : null;
}

// A part made of values only: nothing left once figures, identifiers and
// names are taken out.
function isValue(text: string, names: RegExp | null) {
  const template = numberTemplate(text, names);
  return !isCandidate(text) || (!!template && !/\p{L}{2,}/u.test(template.key.replace(/\b\d+(?:e|er)?\b/g, "")));
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
  // "Bonjour, Afiavi": the label is asked for on its own, never with the name.
  const parts = splitLabel(text);
  if (parts && PROPER_NAME.test(parts.tail)) return false;
  return text.split(" ").length >= 2 || /^[\p{Ll}]/u.test(text);
}

// The figures of a text, in any order: a language may say "octobre 10".
function digitsOf(text: string) {
  return (text.match(/\p{N}+/gu) ?? []).sort().join(" ");
}

// A translation is kept only when it is usable: not empty, not absurdly
// long, and with the same figures as the source, in any order (a grade or a
// date must never change in translation). Its first letter follows the
// source's case.
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
