// Text rules of the French server voice (Azure Speech), shared by the
// browser, which asks for the parts one by one and reads the rest with its
// own voice if the server stops answering, and by the server, which cuts the
// text the same way before synthesising a part.

import { normalise } from "@/features/languages/text";

export const AZURE_VOICE = "fr-FR-DeniseNeural";
// A little slower than the voice's default pace: Kora reads to parents who
// may not read well, often through a phone speaker. Part of the cache key:
// changing it produces new clips.
export const AZURE_RATE = "-10%";
export const MAX_SPOKEN_LENGTH = 6000;
// Short parts: the first one is ready in about a second, and a sentence
// shared by several texts is synthesised once.
export const PART_LENGTH = 300;

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

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };

// Text safe inside an XML element or attribute. Characters XML forbids
// (control characters) are removed: Azure refuses the whole request for one.
export function escapeXml(text: string) {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "").replace(/[&<>"']/g, (c) => ENTITIES[c]!);
}

export function buildSsml(text: string, voice = AZURE_VOICE, rate = AZURE_RATE) {
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="fr-FR">` +
    `<voice name="${escapeXml(voice)}"><prosody rate="${escapeXml(rate)}">${escapeXml(normalise(text))}</prosody></voice></speak>`
  );
}
