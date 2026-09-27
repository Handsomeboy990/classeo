// What may leave the platform for the translation and speech service
// (api229langues). Pure rules, shared by the queue, the routes and the tests.
//
// Only interface text may be sent. A string is refused when it holds an
// e-mail address or a web address, a phone number or an identifier, or when
// it is longer than an interface label. The names of people (every first
// and last name known to the platform, and the names of the reader's page)
// and the figures are replaced by numbered slots before anything is sent:
// "Nouveau message de Afiavi Hounkpatin" is asked as "Nouveau message de 2",
// and the name is put back in the answer on the server.

import { isCandidate, isQueueable, namePattern, normalise, numberTemplate } from "./text";

// Interface labels are short: a longer string is content (a message, an
// announcement), never queued in the background.
export const MAX_QUEUE_LENGTH = 80;

// Name parts shorter than this are ignored ("Da", "Ali" is kept): two
// letters match too many words of the interface.
const MIN_NAME_PART = 3;

export type NameIndex = ReadonlySet<string>;

// Lower case, without accents: "Sènami" and "SENAMI" are the same name.
export function foldName(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").normalize("NFC").toLocaleLowerCase("fr");
}

// Every part of every name ("Marie-Chantal Dossou Yovo": marie, chantal,
// dossou, yovo), folded.
export function buildNameIndex(names: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const name of names) {
    for (const part of name.split(/[\s\-'’.]+/u)) {
      if ([...part].length >= MIN_NAME_PART && /\p{L}/u.test(part)) out.add(foldName(part));
    }
  }
  return out;
}

// The names of a text known to the platform: words written as names (a
// capital first, or all capitals) whose parts are known names, a run of
// them kept whole ("Afiavi Hounkpatin", "HOUNKPATIN Sènami") so a full name
// is one slot. A lower case word is a word of the sentence: "grâce à" is
// not the first name Grâce.
const NAME_WORD = /^[\p{Lu}][\p{L}\p{M}'’-]*$/u;
const TOKENS = /[\p{L}][\p{L}\p{M}'’-]*|[^\p{L}]+/gu;

function isKnownNameWord(word: string, index: NameIndex) {
  if (!NAME_WORD.test(word)) return false;
  if (index.has(foldName(word))) return true;
  return word
    .split(/[-'’]/u)
    .filter(Boolean)
    .some((part) => NAME_WORD.test(part) && index.has(foldName(part)));
}

export function knownNamesIn(text: string, index: NameIndex): string[] {
  const found = new Set<string>();
  let run: string[] = [];
  const close = () => {
    if (run.length) found.add(run.join(" "));
    run = [];
  };
  for (const [token] of text.matchAll(TOKENS)) {
    if (/^\p{L}/u.test(token)) {
      if (isKnownNameWord(token, index)) run.push(token);
      else close();
    } else if (!/^ +$/u.test(token)) close();
  }
  close();
  return [...found];
}

const EMAIL_OR_URL = /[^\s@]+@[^\s@]+|https?:\/\/|www\.|\b[\p{L}\d-]+\.(?:fr|bj|com|org|net|io|app)\b/iu;
// A phone number: four or five pairs of digits, with or without spaces or
// dots, and the country code ("97 12 34 56", "+229 01 97 12 34 56",
// "97123456"). A year span such as "2025-2026" is not one.
const PHONE = /(?<![\p{N}-])(?:\+?229[\s.]?)?(?:\d{2}[\s.]?){3,4}\d{2}(?![\p{N}-])/u;
// An identifier: a run of 6 digits or more, or capitals and figures mixed
// ("FAC-2026-0242", "BJ26000242", "K6W9P-5GQMY"), or 10 capitals in a row.
const LONG_DIGITS = /\p{N}{6,}/u;
const CODE = /(?<![\p{L}\p{N}])(?:(?=[A-Z0-9-]*\d)(?=[A-Z0-9-]*[A-Z][0-9-]*[A-Z])[A-Z0-9][A-Z0-9-]{4,}|[A-Z]{10,})(?![\p{L}\p{N}])/u;

export type Refusal = "length" | "email" | "phone" | "identifier" | "name" | "not_interface";

// Why a text must never be sent, even as a template: contact details and
// identifiers are refused outright, since a template of them would still
// say nothing useful to translate.
export function contactOrIdentifier(text: string): Refusal | null {
  if (EMAIL_OR_URL.test(text)) return "email";
  if (CODE.test(text)) return "identifier";
  if (PHONE.test(text)) return "phone";
  if (LONG_DIGITS.test(text)) return "identifier";
  return null;
}

// The template of a text: every known name, every name of `extra` (the
// reader's page) and every figure replaced by a slot. The values stay on
// the server.
export function privateTemplate(text: string, index: NameIndex, extra: readonly string[] = []) {
  const t = normalise(text);
  const names = namePattern([...knownNamesIn(t, index), ...extra.filter((n) => t.includes(n))]);
  const template = numberTemplate(t, names);
  return { key: template?.key ?? t, values: template?.values ?? new Map<string, string>(), hadName: !!names && names.test(t) };
}

// Whether the key of a template still carries anything personal: a known
// name, or figures other than the single digit slots.
function leaks(key: string, index: NameIndex) {
  return knownNamesIn(key, index).length > 0 || /\p{N}{2,}/u.test(key) || contactOrIdentifier(key) !== null;
}

export type Decision = { ok: true; send: string; templated: boolean } | { ok: false; reason: Refusal };

// The decision for an interface string missing from the cache: the string
// to queue (the text itself, or its template), or the reason it stays in
// French.
export function interfaceDecision(text: string, index: NameIndex, extra: readonly string[] = []): Decision {
  const t = normalise(text);
  if (t.length > MAX_QUEUE_LENGTH) return { ok: false, reason: "length" };
  const contact = contactOrIdentifier(t);
  if (contact) return { ok: false, reason: contact };
  const { key } = privateTemplate(t, index, extra);
  if (leaks(key, index)) return { ok: false, reason: "name" };
  // The rules of an interface label, with the slots read as words.
  if (!isCandidate(key) || !isQueueable(key.replace(/(?<!\p{N})\p{N}(?!\p{N})/gu, "n"))) return { ok: false, reason: "not_interface" };
  return { ok: true, send: key, templated: key !== t };
}

export type FreeSegment = { source: string; key: string; values: Map<string, string> } | { source: string; refused: Refusal };

// A free text (a spoken summary, a page read aloud): each segment either
// sent as its template, or kept in French. `personal` says whether names,
// contact details or identifiers were found, for the speech, which cannot
// read a name without sending it.
export function freeTextPlan(parts: readonly string[], index: NameIndex, extra: readonly string[] = []) {
  let personal = false;
  const segments: FreeSegment[] = parts.map((source) => {
    const contact = contactOrIdentifier(source);
    if (contact) {
      personal = true;
      return { source, refused: contact };
    }
    const { key, values, hadName } = privateTemplate(source, index, extra);
    if (hadName) personal = true;
    if (leaks(key, index)) {
      personal = true;
      return { source, refused: "name" as const };
    }
    return { source, key, values };
  });
  return { segments, personal };
}

// A translated template with its values put back by slot.
export function fillTemplate(translated: string, values: ReadonlyMap<string, string>) {
  return values.size ? translated.replace(/\d+/g, (m) => values.get(m) ?? m) : translated;
}

// A message excerpt ends with an ellipsis: the words before it are what
// the message holds.
export function fragmentCore(text: string) {
  return normalise(text).replace(/(?:…|\.\.\.)$/u, "").trim();
}
