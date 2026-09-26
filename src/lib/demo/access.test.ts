import { describe, expect, it } from "vitest";

import { demoAccessToken, isDemoAccessToken, MAX_ACCESS_TOKEN_LENGTH, safeEqual, showPublicDemoPanel } from "./access";

const TOKEN = "0123456789abcdef0123456789abcdef0123456789abcdef";
const env = (vars: Record<string, string | undefined>) => vars;

describe("safeEqual", () => {
  it("accepts equal strings", () => {
    expect(safeEqual(TOKEN, TOKEN)).toBe(true);
    expect(safeEqual("", "")).toBe(true);
  });

  it("refuses strings that differ anywhere, or by length", () => {
    expect(safeEqual(TOKEN, `${TOKEN.slice(0, -1)}0`)).toBe(false);
    expect(safeEqual(TOKEN, `x${TOKEN.slice(1)}`)).toBe(false);
    expect(safeEqual(TOKEN, TOKEN.slice(0, -1))).toBe(false);
    expect(safeEqual(TOKEN, `${TOKEN}a`)).toBe(false);
    expect(safeEqual("", TOKEN)).toBe(false);
  });

  it("compares strings of different lengths without throwing", () => {
    // timingSafeEqual alone throws on buffers of different lengths.
    expect(() => safeEqual("a", "a much longer value")).not.toThrow();
  });
});

describe("demoAccessToken", () => {
  it("is null when the variable is missing or empty", () => {
    expect(demoAccessToken(env({}))).toBeNull();
    expect(demoAccessToken(env({ DEMO_ACCESS_TOKEN: "" }))).toBeNull();
  });

  it("is null for a token shorter than 32 characters", () => {
    expect(demoAccessToken(env({ DEMO_ACCESS_TOKEN: "a".repeat(31) }))).toBeNull();
    expect(demoAccessToken(env({ DEMO_ACCESS_TOKEN: "a".repeat(32) }))).toBe("a".repeat(32));
  });

  it("is null for a token that would change in a URL path, or too long", () => {
    expect(demoAccessToken(env({ DEMO_ACCESS_TOKEN: `${TOKEN}/x` }))).toBeNull();
    expect(demoAccessToken(env({ DEMO_ACCESS_TOKEN: `${TOKEN} ` }))).toBeNull();
    expect(demoAccessToken(env({ DEMO_ACCESS_TOKEN: `${TOKEN}%20` }))).toBeNull();
    expect(demoAccessToken(env({ DEMO_ACCESS_TOKEN: "a".repeat(MAX_ACCESS_TOKEN_LENGTH + 1) }))).toBeNull();
    expect(demoAccessToken(env({ DEMO_ACCESS_TOKEN: `${TOKEN}-_AZ` }))).toBe(`${TOKEN}-_AZ`);
  });
});

describe("isDemoAccessToken", () => {
  const configured = env({ DEMO_ACCESS_TOKEN: TOKEN });

  it("accepts the configured token", () => {
    expect(isDemoAccessToken(TOKEN, configured)).toBe(true);
  });

  it("refuses a wrong token", () => {
    expect(isDemoAccessToken(TOKEN.toUpperCase(), configured)).toBe(false);
    expect(isDemoAccessToken(TOKEN.slice(0, 32), configured)).toBe(false);
    expect(isDemoAccessToken("", configured)).toBe(false);
    expect(isDemoAccessToken("x".repeat(10_000), configured)).toBe(false);
  });

  it("refuses everything when the variable is missing or too short", () => {
    expect(isDemoAccessToken(TOKEN, env({}))).toBe(false);
    expect(isDemoAccessToken("", env({ DEMO_ACCESS_TOKEN: "" }))).toBe(false);
    expect(isDemoAccessToken("short", env({ DEMO_ACCESS_TOKEN: "short" }))).toBe(false);
  });
});

describe("showPublicDemoPanel", () => {
  it("shows the panel in development unless DEMO_MODE=off", () => {
    expect(showPublicDemoPanel(env({ NODE_ENV: "development" }))).toBe(true);
    expect(showPublicDemoPanel(env({}))).toBe(true);
    expect(showPublicDemoPanel(env({ NODE_ENV: "development", DEMO_MODE: "off" }))).toBe(false);
  });

  it("hides the panel in a production build unless DEMO_MODE=on", () => {
    expect(showPublicDemoPanel(env({ NODE_ENV: "production" }))).toBe(false);
    expect(showPublicDemoPanel(env({ NODE_ENV: "production", DEMO_MODE: "" }))).toBe(false);
    expect(showPublicDemoPanel(env({ NODE_ENV: "production", DEMO_MODE: "true" }))).toBe(false);
    expect(showPublicDemoPanel(env({ NODE_ENV: "production", DEMO_MODE: "on" }))).toBe(true);
  });

  it("never shows the panel on the Vercel production deployment", () => {
    expect(showPublicDemoPanel(env({ NODE_ENV: "production", VERCEL_ENV: "production", DEMO_MODE: "on" }))).toBe(false);
    expect(showPublicDemoPanel(env({ VERCEL_ENV: "production" }))).toBe(false);
  });
});
