import { describe, expect, it } from "vitest";

import { isProductionRun, LOCAL_DEMO_PASSWORD, resolveDemoPassword } from "./password";

describe("resolveDemoPassword", () => {
  it("uses DEMO_PASSWORD whenever it is set", () => {
    expect(resolveDemoPassword({ DEMO_PASSWORD: "a-long-demo-secret" })).toBe("a-long-demo-secret");
    expect(resolveDemoPassword({ DEMO_PASSWORD: "a-long-demo-secret", NODE_ENV: "production" })).toBe("a-long-demo-secret");
    expect(resolveDemoPassword({ DEMO_PASSWORD: "a-long-demo-secret", VERCEL_ENV: "production" })).toBe("a-long-demo-secret");
  });

  it("falls back to the local constant outside production", () => {
    expect(resolveDemoPassword({})).toBe(LOCAL_DEMO_PASSWORD);
    expect(resolveDemoPassword({ NODE_ENV: "development" })).toBe(LOCAL_DEMO_PASSWORD);
    expect(resolveDemoPassword({ NODE_ENV: "test", DEMO_PASSWORD: "" })).toBe(LOCAL_DEMO_PASSWORD);
  });

  it("gives nothing in production without DEMO_PASSWORD", () => {
    expect(resolveDemoPassword({ NODE_ENV: "production" })).toBeNull();
    expect(resolveDemoPassword({ NODE_ENV: "production", DEMO_PASSWORD: "" })).toBeNull();
    expect(resolveDemoPassword({ VERCEL_ENV: "production" })).toBeNull();
  });
});

describe("isProductionRun", () => {
  it("is the Node.js production mode or the Vercel production deployment", () => {
    expect(isProductionRun({ NODE_ENV: "production" })).toBe(true);
    expect(isProductionRun({ VERCEL_ENV: "production" })).toBe(true);
    expect(isProductionRun({ NODE_ENV: "development", VERCEL_ENV: "preview" })).toBe(false);
    expect(isProductionRun({})).toBe(false);
  });
});
