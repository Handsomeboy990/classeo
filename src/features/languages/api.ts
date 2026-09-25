// Client of the api229langues service (https://api229langues.vercel.app/).
// The credentials are passed in by the caller (the server service or the
// pre-translation script): this module never reads them itself and is
// never imported by browser code.

import { batches, polish } from "./text";
import type { TargetLanguage, VoiceName } from "./languages";

export type ApiConfig = { baseUrl: string; token: string; apiKey: string; fetch?: typeof fetch };

// The service refused for quota (HTTP 429): retry after the given delay.
export class QuotaError extends Error {
  constructor(readonly retryAfterMs = 60_000) {
    super("Quota du service de traduction atteint");
    this.name = "QuotaError";
  }
}

// The service is down, slow or answered something unusable.
export class UnavailableError extends Error {
  constructor(message = "Service de traduction indisponible") {
    super(message);
    this.name = "UnavailableError";
  }
}

export const BATCH_SIZE = 100;
export const TTS_MAX_CHARS = 1000;

function headers(config: ApiConfig) {
  return { Authorization: `Bearer ${config.token}`, "X-API-Key": config.apiKey, "Content-Type": "application/json" };
}

async function call(config: ApiConfig, path: string, body: unknown, timeoutMs: number) {
  const doFetch = config.fetch ?? fetch;
  let res: Response;
  try {
    res = await doFetch(`${config.baseUrl.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: headers(config),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    const timeout = error instanceof DOMException && error.name === "TimeoutError";
    throw new UnavailableError(timeout ? "Service de traduction : délai dépassé" : "Service de traduction injoignable");
  }
  if (res.status === 429) {
    const retry = Number(res.headers.get("retry-after"));
    throw new QuotaError(Number.isFinite(retry) && retry > 0 ? retry * 1000 : 60_000);
  }
  if (!res.ok) throw new UnavailableError(`Service de traduction : erreur ${res.status}`);
  return res;
}

// Translates up to 100 French strings in one request. Returns the usable
// translations only, keyed by source; a string the service could not
// translate is absent from the result.
export async function translateBatch(config: ApiConfig, texts: string[], to: TargetLanguage): Promise<Map<string, string>> {
  if (texts.length === 0) return new Map();
  if (texts.length > BATCH_SIZE) throw new Error(`At most ${BATCH_SIZE} texts per batch`);
  // Strings found in the service's own dictionary come back at once; the
  // others go through a model, about a second each: the wait grows with
  // the batch.
  const res = await call(config, "/api/v1/translate/batch", { texts, from_lang: "fr", to_lang: to }, Math.min(240_000, 20_000 + texts.length * 2_000));
  const json = (await res.json().catch(() => null)) as { data?: { index?: number; success?: boolean; translated_text?: unknown }[] } | null;
  if (!json || !Array.isArray(json.data)) throw new UnavailableError("Réponse inattendue du service de traduction");
  const out = new Map<string, string>();
  json.data.forEach((item, i) => {
    const index = typeof item.index === "number" ? item.index : i;
    const source = texts[index];
    if (source === undefined || item.success === false) return;
    const text = polish(source, item.translated_text);
    if (text) out.set(source, text);
  });
  return out;
}

// Translates any number of strings, 100 per request, each request waiting
// for a token first. Stops at the first refusal and returns what it has.
export async function translateMany(
  config: ApiConfig,
  texts: string[],
  to: TargetLanguage,
  takeToken: () => Promise<boolean>,
  onBatch?: (done: Map<string, string>, sent: string[]) => Promise<void> | void,
) {
  const all = new Map<string, string>();
  let complete = true;
  for (const batch of batches(texts, BATCH_SIZE)) {
    if (!(await takeToken())) {
      complete = false;
      break;
    }
    const done = await translateBatch(config, batch, to);
    await onBatch?.(done, batch);
    for (const [k, v] of done) all.set(k, v);
  }
  return { translations: all, complete };
}

// Speech for a text of 1000 characters at most. WAV for Fon, MP3 for Yoruba
// and Hausa. The first call can be slow while the model loads.
export async function synthesise(config: ApiConfig, text: string, voice: VoiceName) {
  const res = await call(config, "/api/v1/tts", { text: text.slice(0, TTS_MAX_CHARS), language: voice }, 110_000);
  const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim();
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength < 100) throw new UnavailableError("Réponse audio vide");
  const mimeType = type.startsWith("audio/") ? type : voice === "fon" ? "audio/wav" : "audio/mpeg";
  return { bytes, mimeType };
}
