// Language of the public pages: French, Fongbe or Yoruba, chosen in the
// address (?lang=fon) and rendered on the server from the translations
// prepared ahead of time. Pure: shared by the pages, the forms, the scripts
// and the tests.

import { createElement, type ReactNode } from "react";

import { normalise, polish } from "@/features/languages/text";

import { PROTECTED_NAMES } from "./texts";

export const PUBLIC_LANGS = [
  { code: "fr", label: "Français" },
  { code: "fon", label: "Fongbe" },
  { code: "yo", label: "Yoruba" },
] as const;

export type PublicLang = (typeof PUBLIC_LANGS)[number]["code"];

export function isPublicLang(value: unknown): value is PublicLang {
  return typeof value === "string" && PUBLIC_LANGS.some((l) => l.code === value);
}

// The value of ?lang= or ?voix=, French when absent or unknown.
export function parsePublicLang(value: unknown): PublicLang {
  const v = Array.isArray(value) ? value[0] : value;
  return isPublicLang(v) ? v : "fr";
}

// The choices of a visitor, read from the address. The voice follows the
// page unless the visitor chose another one (?voix=).
export function publicChoice(sp: Record<string, string | string[] | undefined>) {
  const lang = parsePublicLang(sp.lang);
  const voice = sp.voix === undefined ? lang : parsePublicLang(sp.voix);
  return { lang, voice };
}

// The query string that carries the choices to the next public page:
// nothing for French with a French voice, and ?voix= only when the voice
// differs from the page.
export function choiceQuery(lang: PublicLang, voice: PublicLang, extra: Record<string, string | undefined> = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(extra)) if (v) qs.set(k, v);
  if (lang !== "fr") qs.set("lang", lang);
  if (voice !== lang) qs.set("voix", voice);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export function withChoice(href: string, lang: PublicLang, voice: PublicLang) {
  return `${href}${choiceQuery(lang, voice)}`;
}

// Sign in identifiers quoted as examples: afiavi.hounkpatin, afiavi.hounkpatin2.
const IDENTIFIER = /\b[a-z]+\.[a-z]+\d*\b/g;

function fold(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").normalize("NFC");
}

function protectedTokens(source: string) {
  return [...PROTECTED_NAMES.filter((n) => source.includes(n)), ...(source.match(IDENTIFIER) ?? [])];
}

// A machine translation is used only when it looks sound: not empty, not
// the French text sent back, the same figures, every name and identifier
// of the source kept as written, and no word stuttered by the model.
// Returns the text to show, or null to keep French.
export function acceptTranslation(source: string, translated: unknown): string | null {
  const text = polish(source, translated);
  if (!text || text === normalise(source)) return null;
  if (/[�<>{}]|\bunk\b/i.test(text)) return null;
  // The same word four times in a row (\b is ASCII only: lookarounds).
  if (/(?<!\p{L})(\p{L}+)(?:\s+\1(?!\p{L})){3,}/iu.test(text)) return null;
  let out = text;
  for (const token of protectedTokens(source)) {
    if (out.includes(token)) continue;
    // The model drops accents ("Benin", "Classeo"): the name is put back as
    // written. Any other change to a name keeps the French text.
    const plain = fold(token);
    if (plain === token || !out.includes(plain)) return null;
    out = out.split(plain).join(token);
  }
  // The country and the platform keep their spelling even when the source
  // only had an adjective ("école béninoise" gives "Benin").
  return out.replace(/(?<!\p{L})Benin(?!\p{L})/gu, "Bénin").replace(/(?<!\p{L})Classeo(?!\p{L})/gu, "Classéo");
}

export type PublicTranslator = {
  lang: PublicLang;
  // Translations kept, keyed by French source, for the client forms.
  texts: Record<string, string>;
  // The text to show for a French source.
  t: (french: string) => string;
  // The same, marked lang="fr" when it stays in French on a translated page,
  // so that a screen reader switches voice for it.
  node: (french: string) => ReactNode;
};

// Builds the lookup of a page from the cached rows (French source to raw
// translation). Anything missing or unsound is shown in French.
export function createTranslator(lang: PublicLang, cached: Record<string, string> | Map<string, string>): PublicTranslator {
  const texts: Record<string, string> = {};
  if (lang !== "fr") {
    for (const [source, raw] of cached instanceof Map ? cached : Object.entries(cached)) {
      const ok = acceptTranslation(source, raw);
      if (ok) texts[normalise(source)] = ok;
    }
  }
  const find = (french: string) => texts[french] ?? texts[normalise(french)];
  return {
    lang,
    texts,
    t: (french) => find(french) ?? french,
    node: (french) => {
      const found = find(french);
      if (found || lang === "fr") return found ?? french;
      return createElement("span", { lang: "fr" }, french);
    },
  };
}
