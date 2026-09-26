// Text rules of the French server voice (Piper, voice Siwis), shared by the
// browser, which asks for the parts one by one and reads the rest with its
// own voice if the server stops answering, and by the server, which cuts the
// text the same way before synthesising a part.

import { normalise } from "@/features/languages/text";

// The voice and the pace of api/kora-tts.py. Part of the cache key:
// changing either there must change it here, so that new clips are made.
export const PIPER_VOICE = "fr_FR-siwis-medium";
export const PIPER_PACE = "length_scale=1.1;sentence_silence=0.25";
export const MAX_SPOKEN_LENGTH = 6000;
// Short parts: the first one is ready in a second or two, and a sentence
// shared by several texts is synthesised once.
export const PART_LENGTH = 200;

// Joins items with a space into pieces of at most `max` characters.
function pack(items: string[], max: number) {
  const out: string[] = [];
  let current = "";
  for (const item of items) {
    if (current && current.length + 1 + item.length > max) {
      out.push(current);
      current = item;
    } else current = current ? `${current} ${item}` : item;
  }
  if (current) out.push(current);
  return out;
}

// A sentence too long for one part is cut between clauses, then between
// words; nothing is dropped.
function pieces(sentence: string, max: number): string[] {
  if (sentence.length <= max) return [sentence];
  const words = (clause: string) => clause.split(" ").flatMap((w) => Array.from({ length: Math.ceil(w.length / max) }, (_, i) => w.slice(i * max, (i + 1) * max)));
  return sentence.split(/(?<=,)\s+/u).flatMap((clause) => (clause.length <= max ? [clause] : pack(words(clause), max)));
}

// The parts of a text, in reading order: whole sentences grouped up to
// PART_LENGTH characters.
export function frenchParts(text: string, max = PART_LENGTH): string[] {
  const clean = normalise(text).slice(0, MAX_SPOKEN_LENGTH);
  if (!clean) return [];
  const sentences = clean.split(/(?<=[.!?;])\s+/u).flatMap((s) => pieces(s, max));
  return pack(sentences, max);
}
