// Languages offered by the translation layer. Shared by the server routes and
// the browser: no secret, no server import here.

export const LANGUAGES = [
  { code: "fr", label: "Français", adjective: "français" },
  { code: "fon", label: "Fongbe", adjective: "fongbe" },
  { code: "yo", label: "Yoruba", adjective: "yoruba" },
  { code: "bab", label: "Bariba", adjective: "bariba" },
  { code: "adj", label: "Adja", adjective: "adja" },
  { code: "ee", label: "Ewe", adjective: "ewe" },
  { code: "ha", label: "Haoussa", adjective: "haoussa" },
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
