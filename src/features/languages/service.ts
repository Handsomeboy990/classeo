import "server-only";

import { createHash } from "node:crypto";

import { featureConfig, isEnabled } from "@/lib/features";
import { db } from "@/lib/db";
import { hitRateLimit } from "@/lib/rate-limit";

import { QuotaError, synthesise, translateMany, UnavailableError, type ApiConfig } from "./api";
import { normaliseWav } from "./audio";
import { cacheKey } from "./cache-key";
import { isTargetLanguage, VOICES, type TargetLanguage, type VoiceName } from "./languages";
import { batches, normalise, segments, speechChunks } from "./text";
import { realClock, TokenBucket } from "./token-bucket";

// Server side of the local languages: every call to api229langues goes
// through here, with the credentials read from the environment and never
// sent to the browser. The service allows 5 requests per minute per token,
// so:
// - every result is cached in Translation (key: sha256 of the source text,
//   plus the language) or, for speech, in a FileBlob, and reused forever;
// - calls are spaced by a token bucket in this process and counted in the
//   database, so several instances and the pre-translation script share
//   the same budget;
// - interface strings missing from the cache are queued and translated in
//   the background, 100 per request; the page shows French meanwhile;
// - a refusal or an outage blocks new calls for a while and the pages
//   simply stay in French.

const PER_MINUTE = 5;
export const API_RATE_KEY = "langues229:api";
const MAX_AUDIO_BYTES = 4_000_000; // FILE LIMITS.tts_audio in lib/files.ts

function apiConfig(): ApiConfig | null {
  const baseUrl = process.env.LANGUES229_API_URL;
  const token = process.env.LANGUES229_HF_TOKEN;
  const apiKey = process.env.LANGUES229_API_KEY;
  return baseUrl && token && apiKey ? { baseUrl, token, apiKey } : null;
}

type State = {
  bucket: TokenBucket;
  pending: Map<TargetLanguage, Set<string>>;
  draining: boolean;
  speaking: Map<string, Promise<string | null>>;
};
const g = globalThis as unknown as { __languesState?: State };
const state: State = (g.__languesState ??= {
  bucket: new TokenBucket(PER_MINUTE, 60_000 / PER_MINUTE),
  pending: new Map(),
  draining: false,
  speaking: new Map(),
});

// A token from the local bucket, then a slot in the shared per minute
// window. False when the wait would exceed maxWaitMs.
async function takeToken(maxWaitMs: number) {
  const started = Date.now();
  if (!(await state.bucket.acquire(maxWaitMs))) return false;
  for (;;) {
    const hit = await hitRateLimit(API_RATE_KEY, PER_MINUTE, 60_000);
    if (hit.allowed) return true;
    const left = maxWaitMs - (Date.now() - started);
    if (hit.retryAfterMs + 200 > left) return false;
    await realClock.sleep(hit.retryAfterMs + 200);
  }
}

function onFailure(error: unknown) {
  if (error instanceof QuotaError) state.bucket.block(error.retryAfterMs);
  else if (error instanceof UnavailableError) state.bucket.block(30_000);
  else throw error;
}

// Whether translation is on for this language (option switched on, language
// listed in the option, service configured).
export async function translationAvailable(lang: string): Promise<lang is TargetLanguage> {
  if (!isTargetLanguage(lang) || !(await isEnabled("languages.translation"))) return false;
  const { languages } = await featureConfig("languages.translation");
  return (languages as readonly string[]).includes(lang);
}

export async function voiceAvailable(lang: TargetLanguage): Promise<VoiceName | null> {
  const voice = VOICES[lang];
  if (!voice || !(await isEnabled("languages.voice"))) return null;
  const { languages } = await featureConfig("languages.voice");
  return (languages as readonly string[]).includes(voice) ? voice : null;
}

// Cached translations of the given sources, keyed by normalised source.
export async function lookup(lang: TargetLanguage, texts: string[]) {
  const sources = [...new Set(texts.map(normalise).filter(Boolean))];
  const out = new Map<string, string>();
  for (const part of batches(sources, 500)) {
    const byKey = new Map(part.map((s) => [cacheKey(s), s]));
    const rows = await db.translation.findMany({ where: { lang, key: { in: [...byKey.keys()] } }, select: { key: true, text: true } });
    for (const r of rows) out.set(byKey.get(r.key)!, r.text);
  }
  return out;
}

// Saves a batch. A string the service sent back unusable is stored as its
// own French text, so it is not asked again and again.
async function store(lang: TargetLanguage, done: Map<string, string>, sent: string[]) {
  await db.translation.createMany({
    data: sent.map((source) => ({ key: cacheKey(source), lang, source, text: done.get(source) ?? source })),
    skipDuplicates: true,
  });
}

// Translates now, waiting up to maxWaitMs for the quota. Used when a person
// asked for it (an announcement, a message, a text to listen to).
export async function translateNow(lang: TargetLanguage, texts: string[], maxWaitMs = 20_000) {
  const found = await lookup(lang, texts);
  const missing = [...new Set(texts.map(normalise).filter((t) => t && !found.has(t)))];
  const config = apiConfig();
  if (!missing.length) return { translations: found, complete: true };
  if (!config) return { translations: found, complete: false };
  try {
    const { translations, complete } = await translateMany(config, missing, lang, () => takeToken(maxWaitMs), (done, sent) => store(lang, done, sent));
    for (const [k, v] of translations) found.set(k, v);
    return { translations: found, complete };
  } catch (error) {
    onFailure(error);
    return { translations: found, complete: false };
  }
}

// Background queue for interface strings.
export function enqueue(lang: TargetLanguage, texts: string[]) {
  const set = state.pending.get(lang) ?? new Set<string>();
  for (const t of texts) if (set.size < 2000) set.add(normalise(t));
  state.pending.set(lang, set);
}

export function pendingCount(lang: TargetLanguage) {
  return state.pending.get(lang)?.size ?? 0;
}

// Empties the queue, 100 strings per request, within the quota. Runs after
// the response (see after() in the route); stops after a few batches or at
// the first refusal, the next request picks up the rest.
export async function drain(maxBatches = 6) {
  const config = apiConfig();
  if (state.draining || !config) return;
  state.draining = true;
  try {
    for (let n = 0; n < maxBatches; n++) {
      const [lang, set] = [...state.pending.entries()].sort((a, b) => b[1].size - a[1].size)[0] ?? [];
      if (!lang || !set || set.size === 0) break;
      const batch = [...set].slice(0, 100);
      // Strings cached meanwhile (by another instance) are not sent again.
      const known = await lookup(lang, batch);
      const todo = batch.filter((t) => !known.has(t));
      for (const t of batch) set.delete(t);
      if (!todo.length) continue;
      if (!(await takeToken(65_000))) {
        todo.forEach((t) => set.add(t));
        break;
      }
      try {
        // The token is already taken: one batch of 100 at most.
        await translateMany(config, todo, lang, async () => true, (done, sent) => store(lang, done, sent));
      } catch (error) {
        todo.forEach((t) => set.add(t));
        onFailure(error);
        break;
      }
    }
  } finally {
    state.draining = false;
  }
}

// Speech in a local language for a French text: translated (cache first),
// cut into pieces of 1000 characters, each piece synthesised once and kept
// as a FileBlob. At most `maxParts` pieces per request.
export async function speech(lang: TargetLanguage, voice: VoiceName, french: string, maxParts = 3) {
  const parts = segments(french);
  const { translations, complete } = await translateNow(lang, parts, 25_000);
  if (!complete) return { ok: false as const, reason: "translation" as const };
  const text = parts.map((p) => translations.get(p) ?? p).join(" ");
  const chunks = speechChunks(text).slice(0, maxParts);
  const ids: string[] = [];
  for (const chunk of chunks) {
    const id = await audioFor(voice, chunk);
    if (!id) break;
    ids.push(id);
  }
  if (!ids.length) return { ok: false as const, reason: "voice" as const };
  return { ok: true as const, ids, text, complete: ids.length === speechChunks(text).length };
}

async function audioFor(voice: VoiceName, text: string): Promise<string | null> {
  const name = `kora-${voice}-${cacheKey(text)}`;
  const cachedFile = await db.fileBlob.findFirst({ where: { purpose: "tts_audio", fileName: { startsWith: name } }, select: { id: true } });
  if (cachedFile) return cachedFile.id;
  const config = apiConfig();
  if (!config) return null;
  // Two readers asking for the same clip share one call.
  const inflight = state.speaking.get(name);
  if (inflight) return inflight;
  const job = (async () => {
    if (!(await takeToken(20_000))) return null;
    try {
      const audio = await synthesise(config, text, voice);
      const bytes = audio.mimeType === "audio/wav" ? normaliseWav(audio.bytes) : audio.bytes;
      if (bytes.byteLength > MAX_AUDIO_BYTES) return null;
      const created = await db.fileBlob.create({
        data: {
          ownerUserId: null,
          purpose: "tts_audio",
          fileName: `${name}.${audio.mimeType === "audio/wav" ? "wav" : "mp3"}`,
          mimeType: audio.mimeType,
          size: bytes.byteLength,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          data: Buffer.from(bytes),
        },
        select: { id: true },
      });
      return created.id;
    } catch (error) {
      onFailure(error);
      return null;
    }
  })();
  state.speaking.set(name, job);
  try {
    return await job;
  } finally {
    state.speaking.delete(name);
  }
}
