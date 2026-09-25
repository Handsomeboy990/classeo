import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isPublicSpeechText } from "./allowlist";
import { isPublicClip, publicClipUrl } from "./clip-token";
import { PUBLIC_SPEECH_TEXTS } from "./public-texts";

const LANDING =
  "L'école béninoise, du ministère à la maison. Classéo réunit le ministère, les directions départementales, les écoles et les familles autour des mêmes informations sur chaque élève, pour que chacun voie ce qui le concerne, au bon moment.";

describe("isPublicSpeechText", () => {
  it("accepts the public texts, whatever their spacing", () => {
    expect(PUBLIC_SPEECH_TEXTS).toContain(LANDING);
    expect(isPublicSpeechText(LANDING)).toBe(true);
    expect(isPublicSpeechText(`  ${LANDING.replace(/ /g, "  ")}\n`)).toBe(true);
  });
  it("refuses any other text, even close to a public one", () => {
    expect(isPublicSpeechText("Bonjour")).toBe(false);
    expect(isPublicSpeechText(LANDING.slice(0, -1))).toBe(false);
    expect(isPublicSpeechText(`${LANDING} Et encore une phrase.`)).toBe(false);
  });
});

describe("public clip tokens", () => {
  beforeEach(() => vi.stubEnv("SESSION_SECRET", "x".repeat(40)));
  afterEach(() => vi.unstubAllEnvs());

  it("opens a clip only with the token of that clip", () => {
    const url = publicClipUrl("clip1");
    const token = new URL(url, "http://local").searchParams.get("t");
    expect(url.startsWith("/api/langues/audio/clip1?t=")).toBe(true);
    expect(isPublicClip("clip1", token)).toBe(true);
    expect(isPublicClip("clip2", token)).toBe(false);
    expect(isPublicClip("clip1", null)).toBe(false);
    expect(isPublicClip("clip1", "forged")).toBe(false);
  });
});
