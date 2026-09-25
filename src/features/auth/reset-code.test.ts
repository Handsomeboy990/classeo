import { describe, expect, it } from "vitest";

import {
  generateResetCode,
  hashResetCode,
  matchesResetCode,
  normalizeResetCode,
  RESET_CODE_TTL_MS,
  RESET_MAX_ATTEMPTS,
  resetSecret,
  resetTokenExpiry,
  resetTokenState,
} from "./reset-code";

const SECRET = "a-test-secret-that-is-long-enough-0123456789";

describe("generateResetCode", () => {
  it("always gives six digits, leading zeros included", () => {
    expect(generateResetCode(() => 42)).toBe("000042");
    expect(generateResetCode(() => 999_999)).toBe("999999");
    for (let i = 0; i < 200; i++) expect(generateResetCode()).toMatch(/^\d{6}$/);
  });
  it("draws from the whole range", () => {
    let max = 0;
    generateResetCode((m) => {
      max = m;
      return 0;
    });
    expect(max).toBe(1_000_000);
  });
});

describe("normalizeResetCode", () => {
  it("accepts six digits with spaces or dashes", () => {
    expect(normalizeResetCode("048213")).toBe("048213");
    expect(normalizeResetCode(" 048 213 ")).toBe("048213");
    expect(normalizeResetCode("048-213")).toBe("048213");
  });
  it("refuses anything else", () => {
    for (const bad of ["", "12345", "1234567", "04821a", "０４８２１３", "048213\u0000"]) expect(normalizeResetCode(bad)).toBeNull();
  });
});

describe("hashResetCode and matchesResetCode", () => {
  const hash = hashResetCode("048213", "user-1", SECRET);
  it("never stores the code itself", () => {
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("048213");
  });
  it("matches only the same code, for the same account, with the same secret", () => {
    expect(matchesResetCode(hash, "048213", "user-1", SECRET)).toBe(true);
    expect(matchesResetCode(hash, "048214", "user-1", SECRET)).toBe(false);
    expect(matchesResetCode(hash, "048213", "user-2", SECRET)).toBe(false);
    expect(matchesResetCode(hash, "048213", "user-1", `${SECRET}x`)).toBe(false);
  });
  it("fails closed on a malformed stored hash", () => {
    expect(matchesResetCode("", "048213", "user-1", SECRET)).toBe(false);
    expect(matchesResetCode("zz", "048213", "user-1", SECRET)).toBe(false);
  });
});

describe("resetTokenState", () => {
  const now = new Date("2026-09-25T10:00:00Z");
  const fresh = { expiresAt: resetTokenExpiry(now), usedAt: null, attempts: 0 };
  it("is valid for 15 minutes", () => {
    expect(RESET_CODE_TTL_MS).toBe(15 * 60 * 1000);
    expect(resetTokenState(fresh, now)).toBe("valid");
    expect(resetTokenState(fresh, new Date(now.getTime() + RESET_CODE_TTL_MS - 1))).toBe("valid");
    expect(resetTokenState(fresh, new Date(now.getTime() + RESET_CODE_TTL_MS))).toBe("expired");
  });
  it("is single use", () => {
    expect(resetTokenState({ ...fresh, usedAt: now }, now)).toBe("used");
  });
  it("allows five attempts", () => {
    expect(RESET_MAX_ATTEMPTS).toBe(5);
    expect(resetTokenState({ ...fresh, attempts: 4 }, now)).toBe("valid");
    expect(resetTokenState({ ...fresh, attempts: 5 }, now)).toBe("exhausted");
  });
  it("reports a used code first, whatever its age", () => {
    expect(resetTokenState({ expiresAt: new Date(0), usedAt: now, attempts: 9 }, now)).toBe("used");
  });
});

describe("resetSecret", () => {
  it("requires a strong session secret", () => {
    expect(resetSecret({ SESSION_SECRET: SECRET })).toBe(SECRET);
    expect(() => resetSecret({})).toThrow();
    expect(() => resetSecret({ SESSION_SECRET: "short" })).toThrow();
  });
});
