import "server-only";

import { createHash, createHmac } from "node:crypto";

import { normalise } from "@/features/languages/text";
import { db } from "@/lib/db";
import { validateUpload } from "@/lib/files";

import { PIPER_PACE, PIPER_VOICE } from "./speech-text";

// French voice of Kora on the server: Piper, voice Siwis, the same on every
// device. The synthesis runs in the Python function api/kora-tts.py of the
// same deployment; this module calls it, and keeps every clip as a FileBlob
// (purpose tts_audio) named after a hash of the voice, the pace and the
// text: a clip already made is never asked for again. When the function
// cannot be reached or fails, nothing is stored and the browser reads with
// its own voice.

export type PiperConfig = { url: string; key: string; headers?: Record<string, string>; fetch?: typeof fetch };

// The key the function expects in X-Kora-Key: KORA_TTS_SECRET when set,
// otherwise an HMAC of SESSION_SECRET (same derivation in api/kora-tts.py).
export function ttsKey() {
  const explicit = process.env.KORA_TTS_SECRET;
  if (explicit) return explicit;
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return createHmac("sha256", secret).update("kora-tts").digest("hex");
}

function cookie(request: Request, name: string) {
  const raw = request.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

// Where the function answers. KORA_TTS_URL when set (a local run, see
// scripts/kora-tts-local.py). Otherwise, on Vercel, the function of this
// deployment under the host the request came in on: the production domain
// is public, and on a preview behind Vercel Authentication the visitor's own
// pass (_vercel_jwt) is passed along, or the automation bypass when the
// project has one. Anywhere else there is no server voice.
export function piperConfig(request: Request): PiperConfig | null {
  const key = ttsKey();
  if (!key) return null;
  const headers: Record<string, string> = {};
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) headers["x-vercel-protection-bypass"] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (process.env.KORA_TTS_URL) return { url: process.env.KORA_TTS_URL, key, headers };
  if (!process.env.VERCEL) return null;
  const pass = cookie(request, "_vercel_jwt");
  if (pass) headers.cookie = `_vercel_jwt=${pass}`;
  return { url: new URL("/api/kora-tts", request.url).toString(), key, headers };
}

// The function refused or failed: no call before `retryAfterMs`.
export class PiperError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs: number,
  ) {
    super(message);
    this.name = "PiperError";
  }
}

// Name of the cached clip. The voice and the pace are part of it, so a
// change of either makes new clips instead of reusing old ones.
export function clipKey(text: string, voice = PIPER_VOICE, pace = PIPER_PACE) {
  return createHash("sha256").update(`${voice}\n${pace}\n${normalise(text)}`, "utf8").digest("hex");
}

// One request to the function. Returns WAV bytes. The first request of a
// new instance also fetches the model: up to a minute.
export async function synthesise(config: PiperConfig, text: string): Promise<Uint8Array> {
  const doFetch = config.fetch ?? fetch;
  let res: Response;
  try {
    res = await doFetch(config.url, {
      method: "POST",
      headers: { ...config.headers, "Content-Type": "application/json", "X-Kora-Key": config.key },
      body: JSON.stringify({ text: normalise(text) }),
      signal: AbortSignal.timeout(60_000),
      cache: "no-store",
      redirect: "error",
    });
  } catch {
    throw new PiperError("Kora voice unreachable", 30_000);
  }
  // A text with nothing to pronounce: not an outage.
  if (res.status === 400 || res.status === 422) throw new PiperError(`Kora voice refused the text (${res.status})`, 0);
  // A wrong key, or a preview the server cannot enter: no use trying soon.
  if (res.status === 401 || res.status === 403) throw new PiperError(`Kora voice refused the call (${res.status})`, 10 * 60_000);
  if (!res.ok) throw new PiperError(`Kora voice error ${res.status}`, 30_000);
  return new Uint8Array(await res.arrayBuffer());
}

type State = { blockedUntil: number; inflight: Map<string, Promise<string | null>> };
const g = globalThis as unknown as { __piperSpeech?: State };
const state: State = (g.__piperSpeech ??= { blockedUntil: 0, inflight: new Map() });

export function voiceAvailable(config: PiperConfig | null) {
  return !!config && Date.now() >= state.blockedUntil;
}

// Id of the cached clip of a part, synthesised first if needed. `mayCall`
// is asked before a call to the function (a per user daily budget); null
// when the voice is not configured, failed, or the budget is spent.
export async function frenchClip(config: PiperConfig | null, text: string, mayCall: () => Promise<boolean> = async () => true): Promise<string | null> {
  const name = `kora-fr-${clipKey(text)}`;
  const cached = await db.fileBlob.findFirst({ where: { purpose: "tts_audio", fileName: { startsWith: name } }, select: { id: true } });
  if (cached) return cached.id;
  if (!config || Date.now() < state.blockedUntil) return null;
  // Two readers asking for the same clip share one call.
  const running = state.inflight.get(name);
  if (running) return running;
  const job = (async () => {
    if (!(await mayCall())) return null;
    try {
      const bytes = await synthesise(config, text);
      // The declared type must match the bytes, as for any stored file.
      validateUpload("tts_audio", { size: bytes.byteLength, type: "audio/wav" }, bytes);
      const created = await db.fileBlob.create({
        data: {
          ownerUserId: null,
          purpose: "tts_audio",
          fileName: `${name}.wav`,
          mimeType: "audio/wav",
          size: bytes.byteLength,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          data: Buffer.from(bytes),
        },
        select: { id: true },
      });
      return created.id;
    } catch (error) {
      const wait = error instanceof PiperError ? error.retryAfterMs : 30_000;
      if (wait > 0) state.blockedUntil = Date.now() + wait;
      console.error("french speech failed", error instanceof Error ? error.message : error);
      return null;
    }
  })();
  state.inflight.set(name, job);
  try {
    return await job;
  } finally {
    state.inflight.delete(name);
  }
}

// For the tests: forget a refusal.
export function resetVoiceState() {
  state.blockedUntil = 0;
  state.inflight.clear();
}
