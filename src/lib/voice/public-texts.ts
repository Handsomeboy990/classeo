// Texts that anyone may hear, signed in or not: the ones read aloud on the
// public pages (landing, sign in, forgotten password). The speech routes
// synthesise speech for a signed out visitor only when the text is one of
// these, compared by hash after normalising the spaces, so that nobody can
// spend the speech quota on arbitrary text. For Fon, Yoruba and Hausa the
// browser sends the same French source text and the server translates it:
// the French strings are the whole list.

import { PUBLIC_SPEECH } from "@/features/public-pages/texts";

export const PUBLIC_SPEECH_TEXTS: string[] = [PUBLIC_SPEECH.landing, PUBLIC_SPEECH.signIn, PUBLIC_SPEECH.help];
