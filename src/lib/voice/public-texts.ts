import { PUBLIC_SPEECH } from "@/features/public-pages/texts";

// The exact French texts a signed out visitor may hear in a local language.
// The voice route refuses any other text from an anonymous request, so the
// public pages cannot be used to spend the quota of the translation service
// on arbitrary text.
export const PUBLIC_SPEECH_TEXTS: string[] = [PUBLIC_SPEECH.landing, PUBLIC_SPEECH.signIn, PUBLIC_SPEECH.help];
