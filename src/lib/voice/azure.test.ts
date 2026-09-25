import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { fileBlob } = vi.hoisted(() => ({ fileBlob: { findFirst: vi.fn(), create: vi.fn() } }));
vi.mock("@/lib/db", () => ({ db: { fileBlob } }));

import { AzureError, azureAvailable, clipKey, frenchClip, resetAzureState, synthesise } from "./azure";

// An MPEG audio frame header as Azure sends it (MPEG 2 layer III,
// 48 kbit/s, 24 kHz), then some payload.
const mp3 = new Uint8Array([0xff, 0xf3, 0x64, 0xc4, ...new Array(200).fill(0)]);

function audioResponse(bytes = mp3, status = 200) {
  return new Response(bytes, { status, headers: { "Content-Type": "audio/mpeg" } });
}

describe("clipKey", () => {
  it("depends on the voice, the rate and the normalised text", () => {
    const base = clipKey("Bonjour Afiavi.");
    expect(base).toMatch(/^[0-9a-f]{64}$/);
    expect(clipKey("  Bonjour   Afiavi. ")).toBe(base);
    expect(clipKey("Bonjour Afiavi !")).not.toBe(base);
    expect(clipKey("Bonjour Afiavi.", "fr-FR-EloiseNeural")).not.toBe(base);
    expect(clipKey("Bonjour Afiavi.", undefined, "-20%")).not.toBe(base);
  });
});

describe("synthesise", () => {
  it("posts SSML to the regional endpoint with the expected headers", async () => {
    const fetch = vi.fn(async () => audioResponse());
    const bytes = await synthesise({ key: "k", region: "westeurope", fetch }, "Tom & Léa.");
    expect(bytes).toEqual(mp3);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "Ocp-Apim-Subscription-Key": "k",
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "classeo",
    });
    expect(init.body).toContain('<voice name="fr-FR-DeniseNeural"><prosody rate="-10%">Tom &amp; Léa.</prosody>');
  });
  it("turns refusals and outages into a delay before the next call", async () => {
    const quota = vi.fn(async () => new Response("", { status: 429, headers: { "Retry-After": "7" } }));
    await expect(synthesise({ key: "k", region: "r", fetch: quota }, "x")).rejects.toMatchObject({ retryAfterMs: 7000 });
    const badKey = vi.fn(async () => new Response("", { status: 401 }));
    await expect(synthesise({ key: "k", region: "r", fetch: badKey }, "x")).rejects.toMatchObject({ retryAfterMs: 600_000 });
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(synthesise({ key: "k", region: "r", fetch: down }, "x")).rejects.toBeInstanceOf(AzureError);
  });
});

describe("frenchClip", () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    resetAzureState();
    fileBlob.findFirst.mockReset();
    fileBlob.create.mockReset();
    vi.stubEnv("AZURE_SPEECH_KEY", "secret");
    vi.stubEnv("AZURE_SPEECH_REGION", "westeurope");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    globalThis.fetch = realFetch;
  });

  it("serves a cached clip without calling Azure", async () => {
    const fetch = vi.fn();
    globalThis.fetch = fetch;
    fileBlob.findFirst.mockResolvedValue({ id: "clip1" });
    expect(await frenchClip("Bonjour.")).toBe("clip1");
    expect(fetch).not.toHaveBeenCalled();
    expect(fileBlob.findFirst.mock.calls[0]![0].where.fileName.startsWith).toBe(`kora-fr-${clipKey("Bonjour.")}`);
  });

  it("synthesises a missing clip once, stores it as MP3, and shares a call in flight", async () => {
    const fetch = vi.fn(async () => audioResponse());
    globalThis.fetch = fetch;
    fileBlob.findFirst.mockResolvedValue(null);
    fileBlob.create.mockResolvedValue({ id: "new1" });
    const [a, b] = await Promise.all([frenchClip("Bonjour."), frenchClip("Bonjour.")]);
    expect([a, b]).toEqual(["new1", "new1"]);
    expect(fetch).toHaveBeenCalledTimes(1);
    const data = fileBlob.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ purpose: "tts_audio", mimeType: "audio/mpeg", ownerUserId: null, fileName: `kora-fr-${clipKey("Bonjour.")}.mp3` });
  });

  it("returns null without a key, over budget, or on bytes that are not MP3, and then waits", async () => {
    fileBlob.findFirst.mockResolvedValue(null);
    const fetch = vi.fn(async () => audioResponse(new TextEncoder().encode("<html>erreur</html>")));
    globalThis.fetch = fetch;
    expect(await frenchClip("Budget.", async () => false)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();

    expect(await frenchClip("Pas du MP3.")).toBeNull();
    expect(fileBlob.create).not.toHaveBeenCalled();
    // Blocked for a while after the failure.
    expect(azureAvailable()).toBe(false);
    expect(await frenchClip("Autre.")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);

    resetAzureState();
    vi.stubEnv("AZURE_SPEECH_KEY", "");
    expect(azureAvailable()).toBe(false);
    expect(await frenchClip("Sans clé.")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
