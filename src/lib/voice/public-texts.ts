// Texts that anyone may hear, signed in or not: the ones read aloud on the
// public pages (landing, sign in, forgotten password). The speech routes
// synthesise speech for a signed out visitor only when the text is one of
// these, compared by hash after normalising the spaces, so that nobody can
// spend the speech quota on arbitrary text. For Fon, Yoruba and Hausa the
// browser sends the same French source text and the server translates it:
// the French strings are the whole list.
//
// A public page reading a text aloud must add its exact string here. No
// import from src/app: the pages import this module, not the reverse.

const LANDING_PURPOSE =
  "Classéo réunit le ministère, les directions départementales, les écoles et les familles autour des mêmes informations sur chaque élève, pour que chacun voie ce qui le concerne, au bon moment.";

export const PUBLIC_SPEECH_TEXTS: string[] = [
  // Landing page, hero.
  `L'école béninoise, du ministère à la maison. ${LANDING_PURPOSE}`,
];
