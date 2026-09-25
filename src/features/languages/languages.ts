// Languages offered by the translation layer. Shared by the server routes and
// the browser: no secret, no server import here.

export const LANGUAGES = [
  // bcp47: the tag set on translated regions for screen readers (the
  // service's own codes differ for Bariba and Adja).
  { code: "fr", label: "Français", adjective: "français", bcp47: "fr" },
  { code: "fon", label: "Fongbe", adjective: "fongbe", bcp47: "fon" },
  { code: "yo", label: "Yoruba", adjective: "yoruba", bcp47: "yo" },
  { code: "bab", label: "Bariba", adjective: "bariba", bcp47: "bba" },
  { code: "adj", label: "Adja", adjective: "adja", bcp47: "ajg" },
  { code: "ee", label: "Ewe", adjective: "ewe", bcp47: "ee" },
  { code: "ha", label: "Haoussa", adjective: "haoussa", bcp47: "ha" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];
export type TargetLanguage = Exclude<LanguageCode, "fr">;

export const TARGET_CODES = LANGUAGES.map((l) => l.code).filter((c): c is TargetLanguage => c !== "fr");

// The speech service knows three voices, named by language name.
export const VOICES: Partial<Record<TargetLanguage, "fon" | "yoruba" | "hausa">> = { fon: "fon", yo: "yoruba", ha: "hausa" };
export type VoiceName = "fon" | "yoruba" | "hausa";

export function isTargetLanguage(value: unknown): value is TargetLanguage {
  return typeof value === "string" && (TARGET_CODES as readonly string[]).includes(value);
}

export function languageLabel(code: LanguageCode) {
  return LANGUAGES.find((l) => l.code === code)?.label ?? "Français";
}

export function bcp47(code: LanguageCode) {
  return LANGUAGES.find((l) => l.code === code)?.bcp47 ?? "fr";
}

// "en fongbe", "en haoussa": the complement used in button labels.
export function inLanguage(code: LanguageCode) {
  return `en ${LANGUAGES.find((l) => l.code === code)?.adjective ?? "français"}`;
}

// The voice a language speaks with, when the speech service has one and the
// option lists it.
export function voiceOf(code: LanguageCode, enabled: readonly string[]) {
  const v = code === "fr" ? undefined : VOICES[code];
  return v && enabled.includes(v) ? v : null;
}
