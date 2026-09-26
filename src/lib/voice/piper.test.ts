import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { fileBlob } = vi.hoisted(() => ({ fileBlob: { findFirst: vi.fn(), create: vi.fn() } }));
vi.mock("@/lib/db", () => ({ db: { fileBlob } }));

import { clipKey, frenchClip, piperConfig, PiperError, resetVoiceState, synthesise, ttsKey, voiceAvailable, type PiperConfig } from "./piper";

// The header of a 16 bit mono WAV, as api/kora-tts.py sends, then samples.
function wav(samples = 200) {
  const b = Buffer.alloc(44 + samples * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + samples * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(22050, 24);
  b.writeUInt32LE(44100, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(samples * 2, 40);
  return new Uint8Array(b);
}

const SECRET = "s".repeat(40);
const request = (cookie?: string) => new Request("https://classeo-git-x.vercel.app/api/voix", { headers: cookie ? { cookie } : {} });

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", SECRET);
  vi.stubEnv("KORA_TTS_SECRET", "");
  vi.stubEnv("KORA_TTS_URL", "");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("VERCEL_AUTOMATION_BYPASS_SECRET", "");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("ttsKey", () => {
  it("derives the key from SESSION_SECRET, as api/kora-tts.py does, unless one is set", () => {
    expect(ttsKey()).toBe(createHmac("sha256", SECRET).update("kora-tts").digest("hex"));
    vi.stubEnv("KORA_TTS_SECRET", "explicit");
    expect(ttsKey()).toBe("explicit");
    vi.stubEnv("KORA_TTS_SECRET", "");
    vi.stubEnv("SESSION_SECRET", "short");
    expect(ttsKey()).toBeNull();
  });
});

describe("piperConfig", () => {
  it("has no voice off Vercel without KORA_TTS_URL", () => {
    expect(piperConfig(request())).toBeNull();
    expect(voiceAvailable(piperConfig(request()))).toBe(false);
  });
  it("uses KORA_TTS_URL when set", () => {
    vi.stubEnv("KORA_TTS_URL", "http://127.0.0.1:8765");
    expect(piperConfig(request())).toEqual({ url: "http://127.0.0.1:8765", key: ttsKey(), headers: {} });
  });
  it("on Vercel, calls the function of the same host and passes only the preview pass along", () => {
    vi.stubEnv("VERCEL", "1");
    const config = piperConfig(request("classeo_session=abc; _vercel_jwt=pass.jwt; other=1"));
    expect(config?.url).toBe("https://classeo-git-x.vercel.app/api/kora-tts");
    expect(config?.headers).toEqual({ cookie: "_vercel_jwt=pass.jwt" });
    vi.stubEnv("VERCEL_AUTOMATION_BYPASS_SECRET", "bypass");
    expect(piperConfig(request())?.headers).toEqual({ "x-vercel-protection-bypass": "bypass" });
  });
});

describe("clipKey", () => {
  it("depends on the voice, the pace and the normalised text", () => {
    const base = clipKey("Bonjour Afiavi.");
    expect(base).toMatch(/^[0-9a-f]{64}$/);
    expect(clipKey("  Bonjour   Afiavi. ")).toBe(base);
    expect(clipKey("Bonjour Afiavi !")).not.toBe(base);
    expect(clipKey("Bonjour Afiavi.", "fr_FR-upmc-medium")).not.toBe(base);
    expect(clipKey("Bonjour Afiavi.", undefined, "length_scale=1.0")).not.toBe(base);
  });
});

describe("synthesise", () => {
  it("posts the text with the key and returns the WAV", async () => {
    const fetch = vi.fn(async () => new Response(wav(), { headers: { "Content-Type": "audio/wav" } }));
    const config: PiperConfig = { url: "https://x/api/kora-tts", key: "k", headers: { cookie: "_vercel_jwt=p" }, fetch };
    const bytes = await synthesise(config, "  Tom  et Léa. ");
    expect(bytes).toEqual(wav());
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://x/api/kora-tts");
    expect(init.headers).toEqual({ cookie: "_vercel_jwt=p", "Content-Type": "application/json", "X-Kora-Key": "k" });
    expect(JSON.parse(init.body as string)).toEqual({ text: "Tom et Léa." });
  });
  it("turns refusals and outages into a delay before the next call", async () => {
    const answer = (status: number) => vi.fn(async () => new Response("{}", { status }));
    await expect(synthesise({ url: "u", key: "k", fetch: answer(403) }, "x")).rejects.toMatchObject({ retryAfterMs: 600_000 });
    await expect(synthesise({ url: "u", key: "k", fetch: answer(503) }, "x")).rejects.toMatchObject({ retryAfterMs: 30_000 });
    await expect(synthesise({ url: "u", key: "k", fetch: answer(422) }, "x")).rejects.toMatchObject({ retryAfterMs: 0 });
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(synthesise({ url: "u", key: "k", fetch: down }, "x")).rejects.toBeInstanceOf(PiperError);
  });
});

describe("frenchClip", () => {
  beforeEach(() => {
    resetVoiceState();
    fileBlob.findFirst.mockReset();
    fileBlob.create.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("serves a cached clip without calling the voice", async () => {
    const fetch = vi.fn();
    fileBlob.findFirst.mockResolvedValue({ id: "clip1" });
    expect(await frenchClip({ url: "u", key: "k", fetch }, "Bonjour.")).toBe("clip1");
    expect(fetch).not.toHaveBeenCalled();
    expect(fileBlob.findFirst.mock.calls[0]![0].where.fileName.startsWith).toBe(`kora-fr-${clipKey("Bonjour.")}`);
  });

  it("synthesises a missing clip once, stores it as WAV, and shares a call in flight", async () => {
    const fetch = vi.fn(async () => new Response(wav()));
    fileBlob.findFirst.mockResolvedValue(null);
    fileBlob.create.mockResolvedValue({ id: "new1" });
    const config = { url: "u", key: "k", fetch };
    const [a, b] = await Promise.all([frenchClip(config, "Bonjour."), frenchClip(config, "Bonjour.")]);
    expect([a, b]).toEqual(["new1", "new1"]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fileBlob.create.mock.calls[0]![0].data).toMatchObject({ purpose: "tts_audio", mimeType: "audio/wav", ownerUserId: null, fileName: `kora-fr-${clipKey("Bonjour.")}.wav` });
  });

  it("returns null without a voice, over budget, or on bytes that are not WAV, and then waits", async () => {
    fileBlob.findFirst.mockResolvedValue(null);
    const fetch = vi.fn(async () => new Response(new TextEncoder().encode("<html>erreur</html>")));
    const config = { url: "u", key: "k", fetch };
    expect(await frenchClip(null, "Sans voix.")).toBeNull();
    expect(await frenchClip(config, "Budget.", async () => false)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();

    expect(await frenchClip(config, "Pas du WAV.")).toBeNull();
    expect(fileBlob.create).not.toHaveBeenCalled();
    // Blocked for a while after the failure.
    expect(voiceAvailable(config)).toBe(false);
    expect(await frenchClip(config, "Autre.")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not block the voice for a text it could not pronounce", async () => {
    fileBlob.findFirst.mockResolvedValue(null);
    const config = { url: "u", key: "k", fetch: vi.fn(async () => new Response("{}", { status: 422 })) };
    expect(await frenchClip(config, "...")).toBeNull();
    expect(voiceAvailable(config)).toBe(true);
  });
});
