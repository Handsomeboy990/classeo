import "server-only";

import { cacheKey } from "@/features/languages/cache-key";

import { PUBLIC_SPEECH_TEXTS } from "./public-texts";

// Hashes of the public texts, computed once. A signed out visitor gets
// speech only for one of these (see public-texts.ts).
const PUBLIC_KEYS = new Set(PUBLIC_SPEECH_TEXTS.map(cacheKey));

export function isPublicSpeechText(text: string) {
  return PUBLIC_KEYS.has(cacheKey(text));
}
