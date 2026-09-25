import { describe, expect, it, vi } from "vitest";

import { QuotaError, translateBatch, translateMany, UnavailableError, type ApiConfig } from "./api";
import { normaliseWav } from "./audio";
import { cacheKey } from "./cache-key";
import { voiceOf } from "./languages";
import { batches, isCandidate, isQueueable, polish, segments, speechChunks } from "./text";
import { TokenBucket, type Clock } from "./token-bucket";

function fakeClock(start = 0): Clock & { t: number } {
  const c = {
    t: start,
    now: () => c.t,
    sleep: async (ms: number) => {
      c.t += ms;
    },
  };
  return c;
}

// Distinct strings without figures: "texte ba", "texte bb"...
const words = (n: number) => Array.from({ length: n }, (_, i) => `texte ${[...i.toString(26)].map((c) => String.fromCharCode(97 + parseInt(c, 26))).join("")}`);

function config(fetchMock: typeof fetch): ApiConfig {
  return { baseUrl: "https://api.test/", token: "hf", apiKey: "key", fetch: fetchMock };
}

function batchResponse(texts: string[], translate: (s: string) => string) {
  return new Response(JSON.stringify({ success: true, data: texts.map((t, index) => ({ index, success: true, original_text: t, translated_text: translate(t) })) }), {
    headers: { "content-type": "application/json" },
  });
}

describe("cacheKey", () => {
  it("is the sha256 of the normalised text", () => {
    expect(cacheKey("Bonjour")).toBe("9172e8eec99f144f72eca9a568759580edadb2cfd154857f07e657569493bc44");
    expect(cacheKey("  Mes   enfants\n")).toBe(cacheKey("Mes enfants"));
    expect(cacheKey("Mes enfants")).not.toBe(cacheKey("mes enfants"));
    expect(cacheKey("x")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("batches", () => {
  it("removes duplicates and cuts at 100", () => {
    const items = Array.from({ length: 250 }, (_, i) => `t${i % 230}`);
    const out = batches(items, 100);
    expect(out.map((b) => b.length)).toEqual([100, 100, 30]);
    expect(new Set(out.flat()).size).toBe(230);
  });
  it("returns nothing for an empty list", () => {
    expect(batches([])).toEqual([]);
  });
});

describe("text rules", () => {
  it("leaves figures, grades, dates, initials and addresses alone", () => {
    for (const t of ["13,5/20", "3e A", "12 000 FCFA", "T1", "SH", "25/09/2026", "afiavi@exemple.bj", "·"]) expect(isCandidate(t)).toBe(false);
    for (const t of ["Mes enfants", "Bulletins", "Emploi du temps", "Trimestre 1"]) expect(isCandidate(t)).toBe(true);
  });
  it("never queues a probable name or a text with a figure", () => {
    expect(isQueueable("Sènami Hounkpatin")).toBe(false);
    expect(isQueueable("CEG Akpakpa Centre")).toBe(false);
    expect(isQueueable("Trimestre 1")).toBe(false);
    expect(isQueueable("Hounkpatin")).toBe(false);
    expect(isQueueable("Voir le bulletin")).toBe(true);
    expect(isQueueable("absent")).toBe(true);
  });
  it("keeps a translation only with the same figures, and the source's capital", () => {
    expect(polish("Bonjour", "ku do zanzan")).toBe("Ku do zanzan");
    expect(polish("Trimestre 1", "Akɔ 2")).toBeNull();
    expect(polish("Trimestre 1", "Akɔ 1")).toBe("Akɔ 1");
    expect(polish("Bonjour", "")).toBeNull();
    expect(polish("Bonjour", 42)).toBeNull();
  });
  it("cuts long texts into paragraphs and sentences, speech into 1000 characters", () => {
    expect(segments("Premier paragraphe.\n\nSecond.")).toEqual(["Premier paragraphe.", "Second."]);
    const long = Array.from({ length: 30 }, (_, i) => `Phrase numéro ${i} assez longue pour compter.`).join(" ");
    expect(segments(long).every((s) => s.length <= 400)).toBe(true);
    expect(segments(long).join(" ")).toBe(long);
    const chunks = speechChunks(Array.from({ length: 60 }, () => "Une phrase de test lue par Kora.").join(" "));
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 1000)).toBe(true);
  });
  it("gives a voice to Fon, Yoruba and Hausa only when the option lists it", () => {
    expect(voiceOf("fon", ["fon", "yoruba", "hausa"])).toBe("fon");
    expect(voiceOf("yo", ["fon"])).toBeNull();
    expect(voiceOf("bab", ["fon", "yoruba", "hausa"])).toBeNull();
    expect(voiceOf("fr", ["fon"])).toBeNull();
  });
});

describe("TokenBucket", () => {
  it("lets 5 calls through, then one every 12 seconds", async () => {
    const clock = fakeClock();
    const bucket = new TokenBucket(5, 12_000, clock);
    for (let i = 0; i < 5; i++) expect(await bucket.acquire(0)).toBe(true);
    expect(clock.t).toBe(0);
    expect(await bucket.acquire(1000)).toBe(false);
    expect(await bucket.acquire(20_000)).toBe(true);
    expect(clock.t).toBe(12_000);
  });
  it("serves concurrent callers in order without sharing a token", async () => {
    const clock = fakeClock();
    const bucket = new TokenBucket(1, 10_000, clock);
    const results = await Promise.all([bucket.acquire(60_000), bucket.acquire(60_000), bucket.acquire(60_000)]);
    expect(results).toEqual([true, true, true]);
    expect(clock.t).toBe(20_000);
  });
  it("blocks every call after a refusal from the service", async () => {
    const clock = fakeClock();
    const bucket = new TokenBucket(5, 12_000, clock);
    bucket.block(60_000);
    expect(bucket.waitTime()).toBe(60_000);
    expect(await bucket.acquire(30_000)).toBe(false);
  });
});

describe("translation client", () => {
  it("sends both credentials and maps results by source", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { texts: string[]; to_lang: string };
      expect(body.to_lang).toBe("fon");
      return batchResponse(body.texts, (t) => `fon:${t}`);
    });
    const out = await translateBatch(config(fetchMock as unknown as typeof fetch), ["Bonjour", "Mes enfants"], "fon");
    expect(out.get("Mes enfants")).toBe("Fon:Mes enfants");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.test/api/v1/translate/batch");
    expect((init!.headers as Record<string, string>).Authorization).toBe("Bearer hf");
    expect((init!.headers as Record<string, string>)["X-API-Key"]).toBe("key");
  });
  it("sends 250 strings in 3 requests, each after a token", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { texts: string[] };
      expect(body.texts.length).toBeLessThanOrEqual(100);
      return batchResponse(body.texts, (t) => t.toUpperCase());
    });
    const takeToken = vi.fn(async () => true);
    const texts = words(250);
    const { translations, complete } = await translateMany(config(fetchMock as unknown as typeof fetch), texts, "yo", takeToken);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(takeToken).toHaveBeenCalledTimes(3);
    expect(complete).toBe(true);
    expect(translations.size).toBe(250);
  });
  it("stops when no token is left and reports it", async () => {
    const fetchMock = vi.fn(async (_u: string | URL | Request, init?: RequestInit) => batchResponse((JSON.parse(String(init?.body)) as { texts: string[] }).texts, (t) => t));
    let tokens = 1;
    const texts = words(150);
    const { complete } = await translateMany(config(fetchMock as unknown as typeof fetch), texts, "fon", async () => tokens-- > 0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(complete).toBe(false);
  });
  it("turns 429 into a quota error and a network failure into an outage", async () => {
    const quota = vi.fn(async () => new Response("slow down", { status: 429, headers: { "retry-after": "30" } }));
    await expect(translateBatch(config(quota as unknown as typeof fetch), ["Bonjour"], "fon")).rejects.toEqual(new QuotaError(30_000));
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(translateBatch(config(down as unknown as typeof fetch), ["Bonjour"], "fon")).rejects.toBeInstanceOf(UnavailableError);
    const broken = vi.fn(async () => new Response("<html>", { status: 200 }));
    await expect(translateBatch(config(broken as unknown as typeof fetch), ["Bonjour"], "fon")).rejects.toBeInstanceOf(UnavailableError);
  });
});

describe("normaliseWav", () => {
  function wav(samples: number[]) {
    const bytes = new Uint8Array(44 + samples.length * 2);
    const v = new DataView(bytes.buffer);
    const put = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
    put(0, "RIFF");
    v.setUint32(4, 36 + samples.length * 2, true);
    put(8, "WAVE");
    put(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, 16000, true);
    v.setUint32(28, 32000, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    put(36, "data");
    v.setUint32(40, samples.length * 2, true);
    samples.forEach((s, i) => v.setInt16(44 + i * 2, s, true));
    return bytes;
  }
  const peak = (b: Uint8Array) => {
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let p = 0;
    for (let i = 44; i < b.byteLength; i += 2) p = Math.max(p, Math.abs(v.getInt16(i, true)));
    return p;
  };
  it("raises a quiet clip to the target level", () => {
    expect(peak(normaliseWav(wav([0, 5000, -8000, 3000])))).toBe(Math.round(8000 * ((0.89 * 32767) / 8000)));
  });
  it("caps the gain and leaves loud or foreign files alone", () => {
    expect(peak(normaliseWav(wav([100, -200])))).toBe(1200);
    const loud = wav([30000, -31000]);
    expect(normaliseWav(loud)).toBe(loud);
    const mp3 = new Uint8Array([0x49, 0x44, 0x33, ...new Array(60).fill(0)]);
    expect(normaliseWav(mp3)).toBe(mp3);
  });
});
