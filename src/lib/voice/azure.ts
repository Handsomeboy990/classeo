import "server-only";

import { createHash } from "node:crypto";

import { normalise } from "@/features/languages/text";
import { db } from "@/lib/db";
import { validateUpload } from "@/lib/files";

import { AZURE_RATE, AZURE_VOICE, buildSsml } from "./speech-text";

// French voice of Kora on the server: Azure Speech, voice Denise, the same
// on every device. Every clip is synthesised once and kept as a FileBlob
// (purpose tts_audio), named after a hash of the voice, the rate and the
// text: a clip already made is never asked for again. Without a key, or
// while Azure refuses, nothing is called and the browser reads with its own
// voice. The key is read from the environment here and never leaves the
// server.

export type AzureConfig = { key: string; region: string; fetch?: typeof fetch };

export function azureConfig(): AzureConfig | null {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  return key && region && /^[a-z0-9-]+$/i.test(region) ? { key, region } : null;
}

// Azure refused or failed: no call before `retryAfterMs`.
export class AzureError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs: number,
  ) {
    super(message);
    this.name = "AzureError";
  }
}

// Name of the cached clip. The rate and the voice are part of it, so a
// change of either makes new clips instead of reusing old ones.
export function clipKey(text: string, voice = AZURE_VOICE, rate = AZURE_RATE) {
  return createHash("sha256").update(`${voice}\n${rate}\n${normalise(text)}`, "utf8").digest("hex");
}

// One request to the Azure text to speech REST API. Returns MP3 bytes.
export async function synthesise(config: AzureConfig, text: string): Promise<Uint8Array> {
  const doFetch = config.fetch ?? fetch;
  let res: Response;
  try {
    res = await doFetch(`https://${config.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": config.key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "classeo",
      },
      body: buildSsml(text),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch {
    throw new AzureError("Azure Speech unreachable", 30_000);
  }
  if (res.status === 429) {
    const retry = Number(res.headers.get("retry-after"));
    throw new AzureError("Azure Speech quota", Number.isFinite(retry) && retry > 0 ? retry * 1000 : 60_000);
  }
  // A wrong key or region: no use trying again soon.
  if (res.status === 401 || res.status === 403) throw new AzureError(`Azure Speech refused the key (${res.status})`, 10 * 60_000);
  if (!res.ok) throw new AzureError(`Azure Speech error ${res.status}`, 30_000);
  return new Uint8Array(await res.arrayBuffer());
}

type State = { blockedUntil: number; inflight: Map<string, Promise<string | null>> };
const g = globalThis as unknown as { __azureSpeech?: State };
const state: State = (g.__azureSpeech ??= { blockedUntil: 0, inflight: new Map() });

export function azureAvailable() {
  return !!azureConfig() && Date.now() >= state.blockedUntil;
}

// Id of the cached clip of a part, synthesised first if needed. `mayCall`
// is asked before a call to Azure (a per user daily budget); null when
// Azure is not configured, refused, or the budget is spent.
export async function frenchClip(text: string, mayCall: () => Promise<boolean> = async () => true): Promise<string | null> {
  const name = `kora-fr-${clipKey(text)}`;
  const cached = await db.fileBlob.findFirst({ where: { purpose: "tts_audio", fileName: { startsWith: name } }, select: { id: true } });
  if (cached) return cached.id;
  const config = azureConfig();
  if (!config || Date.now() < state.blockedUntil) return null;
  // Two readers asking for the same clip share one call.
  const running = state.inflight.get(name);
  if (running) return running;
  const job = (async () => {
    if (!(await mayCall())) return null;
    try {
      const bytes = await synthesise(config, text);
      // The declared type must match the bytes, as for any stored file.
      validateUpload("tts_audio", { size: bytes.byteLength, type: "audio/mpeg" }, bytes);
      const created = await db.fileBlob.create({
        data: {
          ownerUserId: null,
          purpose: "tts_audio",
          fileName: `${name}.mp3`,
          mimeType: "audio/mpeg",
          size: bytes.byteLength,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          data: Buffer.from(bytes),
        },
        select: { id: true },
      });
      return created.id;
    } catch (error) {
      state.blockedUntil = Date.now() + (error instanceof AzureError ? error.retryAfterMs : 30_000);
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
export function resetAzureState() {
  state.blockedUntil = 0;
  state.inflight.clear();
}
