import { describe, expect, it } from "vitest";

import { canonicalJson, contentHash, initials, newVerificationCode, normalizeCode, REVOKE_PERMISSION, shortUrl, statusOf, verificationUrl, DOCUMENT_KINDS } from "./reference";

describe("verification codes", () => {
  it("draws 10 characters of Crockford base 32 in two groups", () => {
    const code = newVerificationCode();
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/);
    expect(newVerificationCode(() => 0)).toBe("00000-00000");
    expect(newVerificationCode(() => 31)).toBe("ZZZZZ-ZZZZZ");
  });

  it("does not repeat over many draws", () => {
    const seen = new Set(Array.from({ length: 5000 }, () => newVerificationCode()));
    expect(seen.size).toBe(5000);
  });

  it("normalises what a visitor types", () => {
    expect(normalizeCode("k7qd4 m2xph")).toBe("K7QD4-M2XPH");
    expect(normalizeCode("K7QD4-M2XPH")).toBe("K7QD4-M2XPH");
    // O read as zero, I and L as one.
    expect(normalizeCode("o7qd4-m2xpi")).toBe("07QD4-M2XP1");
    expect(normalizeCode("K7QD4-M2XP")).toBeNull();
    expect(normalizeCode("K7QD4-M2XPU")).toBeNull();
    expect(normalizeCode("../etc/passwd")).toBeNull();
  });
});

describe("canonicalJson and contentHash", () => {
  it("does not depend on key order and serialises dates", () => {
    const a = { b: 1, a: { d: new Date("2026-09-25T00:00:00Z"), c: [2, 1] } };
    const b = { a: { c: [2, 1], d: new Date("2026-09-25T00:00:00Z") }, b: 1 };
    expect(canonicalJson(a)).toBe('{"a":{"c":[2,1],"d":"2026-09-25T00:00:00.000Z"},"b":1}');
    expect(contentHash(a)).toBe(contentHash(b));
  });

  it("changes with any fact of the content", () => {
    expect(contentHash({ average: 12.5 })).not.toBe(contentHash({ average: 12.75 }));
    expect(contentHash({ x: undefined, y: 1 })).toBe(contentHash({ y: 1 }));
  });
});

describe("public details", () => {
  it("shows initials only", () => {
    expect(initials("Sènami", "Hounkpatin")).toBe("S. H.");
    expect(initials("Afi-Rose", "de Souza")).toBe("A. R. D. S.");
    expect(initials(null, "Dossou")).toBe("D.");
  });

  it("reads the status from the document and its signature", () => {
    expect(statusOf(null)).toBe("unknown");
    expect(statusOf({ revokedAt: null })).toBe("valid");
    expect(statusOf({ revokedAt: new Date() })).toBe("revoked");
    expect(statusOf({ revokedAt: null }, { revokedAt: new Date() })).toBe("revoked");
  });

  it("builds the address printed under the QR code", () => {
    const url = verificationUrl("https://classeo.bj/", "K7QD4-M2XPH");
    expect(url).toBe("https://classeo.bj/verifier/K7QD4-M2XPH");
    expect(shortUrl(url)).toBe("classeo.bj/verifier/K7QD4-M2XPH");
  });

  it("names a revoking right for every kind of document", () => {
    for (const kind of Object.keys(DOCUMENT_KINDS)) expect(REVOKE_PERMISSION[kind as keyof typeof DOCUMENT_KINDS]).toMatch(/^[a-z_]+:[a-z]+$/);
  });
});
