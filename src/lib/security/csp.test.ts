import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { baselinePolicy, newNonce, PREFERENCES_HASHES, PREFERENCES_SCRIPTS, strictHeaderName, strictPolicy } from "./csp";

const prod = { dev: false, httpsOnly: true, analytics: false };
const directives = (policy: string) => Object.fromEntries(policy.split("; ").map((d) => [d.split(" ")[0], d.slice(d.indexOf(" ") + 1)]));

describe("strict policy", () => {
  it("runs no inline script without the nonce, except the preferences script by its hash", () => {
    const d = directives(strictPolicy({ ...prod, nonce: "abc123==" }));
    expect(d["script-src"]).toBe(`'self' 'nonce-abc123==' 'strict-dynamic' ${PREFERENCES_HASHES.join(" ")}`);
    expect(d["script-src"]).not.toContain("unsafe-inline");
    expect(d["script-src"]).not.toContain("unsafe-eval");
    expect(PREFERENCES_HASHES).toEqual(PREFERENCES_SCRIPTS.map((s) => `'sha256-${createHash("sha256").update(s).digest("base64")}'`));
  });

  it("forbids framing, plugins, foreign forms and base tags, and reports violations", () => {
    const d = directives(strictPolicy({ ...prod, nonce: "n" }));
    expect(d["frame-ancestors"]).toBe("'none'");
    expect(d["object-src"]).toBe("'none'");
    expect(d["form-action"]).toBe("'self'");
    expect(d["base-uri"]).toBe("'self'");
    expect(d["default-src"]).toBe("'self'");
    expect(d["connect-src"]).toBe("'self'");
    expect(d["worker-src"]).toBe("'self'");
    expect(d["report-uri"]).toBe("/api/csp-report");
    expect(d["upgrade-insecure-requests"]).toBeDefined();
  });

  it("opens Google only when analytics is configured, eval only in development", () => {
    const withGa = directives(strictPolicy({ ...prod, analytics: true, nonce: "n" }));
    expect(withGa["script-src"]).toContain("https://www.googletagmanager.com");
    expect(withGa["connect-src"]).toContain("https://*.google-analytics.com");
    expect(directives(strictPolicy({ ...prod, dev: true, nonce: "n" }))["script-src"]).toContain("'unsafe-eval'");
    expect(directives(strictPolicy({ ...prod, httpsOnly: false, nonce: "n" }))["upgrade-insecure-requests"]).toBeUndefined();
  });

  it("is report only unless CSP_STRICT=enforce", () => {
    expect(strictHeaderName({})).toBe("Content-Security-Policy-Report-Only");
    expect(strictHeaderName({ CSP_STRICT: "enforce" })).toBe("Content-Security-Policy");
  });

  it("draws a fresh 128 bit nonce each time", () => {
    const a = newNonce();
    expect(Buffer.from(a, "base64")).toHaveLength(16);
    expect(newNonce()).not.toBe(a);
  });
});

describe("the root layout", () => {
  it("runs the very preferences script whose hash the strict policy allows", () => {
    const layout = readFileSync(path.resolve(__dirname, "../../app/layout.tsx"), "utf8");
    const inline = layout.match(/const preferencesScript = `([^`]*)`;/)?.[1];
    expect(PREFERENCES_SCRIPTS).toContain(inline);
  });
});

describe("self hosted fonts and same origin images", () => {
  it("are allowed by both policies", () => {
    for (const policy of [baselinePolicy(prod), strictPolicy({ ...prod, nonce: "n" })]) {
      const d = directives(policy);
      expect(d["font-src"]).toContain("'self'");
      expect(d["img-src"]).toContain("'self'");
    }
  });
});

describe("baseline policy", () => {
  it("keeps the same origin rules and frame protection", () => {
    const d = directives(baselinePolicy(prod));
    expect(d["frame-ancestors"]).toBe("'none'");
    expect(d["object-src"]).toBe("'none'");
    expect(d["script-src"]).toBe("'self' 'unsafe-inline'");
  });
});
