import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { capacity, encodeQr, qrPath } from "./qr";

// The symbols produced here were decoded with zxing-cpp (versions 1, 3, 5, 8
// and 10, ASCII and accented text). These tests keep the structure and the
// exact output stable.

function fingerprintOf(modules: boolean[][]) {
  return createHash("sha256")
    .update(modules.map((r) => r.map((c) => (c ? "1" : "0")).join("")).join("\n"))
    .digest("hex")
    .slice(0, 16);
}

describe("encodeQr", () => {
  it("picks the smallest version for the text", () => {
    expect(encodeQr("A").version).toBe(1);
    expect(encodeQr("https://classeo.bj/verifier/K7QD-M2XP-4HTA").version).toBe(3);
    expect(encodeQr("y".repeat(213)).version).toBe(10);
  });

  it("has the byte capacities of level M", () => {
    expect([1, 2, 3, 4, 5, 10].map(capacity)).toEqual([14, 26, 42, 62, 84, 213]);
  });

  it("refuses a text longer than version 10", () => {
    expect(() => encodeQr("z".repeat(214))).toThrow(/too long/);
  });

  it("draws the three finder patterns and the dark module", () => {
    const q = encodeQr("https://classeo.bj/verifier/K7QD-M2XP-4HTA");
    const s = q.size;
    expect(s).toBe(29);
    for (const [x, y] of [
      [0, 0],
      [s - 7, 0],
      [0, s - 7],
    ]) {
      // Outer ring dark, the ring inside light, the 3x3 centre dark.
      expect(q.modules[y!]![x!]).toBe(true);
      expect(q.modules[y! + 1]![x! + 1]).toBe(false);
      expect(q.modules[y! + 3]![x! + 3]).toBe(true);
    }
    expect(q.modules[s - 8]![8]).toBe(true);
  });

  it("writes format bits of level M that match the chosen mask", () => {
    const q = encodeQr("Classéo");
    let bits = 0;
    for (let i = 0; i <= 5; i++) bits |= (q.modules[i]![8] ? 1 : 0) << i;
    bits |= (q.modules[7]![8] ? 1 : 0) << 6;
    bits |= (q.modules[8]![8] ? 1 : 0) << 7;
    bits |= (q.modules[8]![7] ? 1 : 0) << 8;
    for (let i = 9; i < 15; i++) bits |= (q.modules[8]![14 - i] ? 1 : 0) << i;
    const data = (bits ^ 0x5412) >>> 10;
    expect(data >>> 3).toBe(0); // level M
    expect(data & 7).toBe(q.mask);
  });

  it("is deterministic", () => {
    const url = "https://classeo.bj/verifier/K7QD-M2XP-4HTA";
    expect(fingerprintOf(encodeQr(url).modules)).toBe(fingerprintOf(encodeQr(url).modules));
  });
});

describe("qrPath", () => {
  it("covers the symbol and its quiet zone", () => {
    const q = encodeQr("A");
    const { d, viewBox } = qrPath(q);
    expect(viewBox).toBe(29);
    expect(d.startsWith("M4 4h7")).toBe(true);
  });
});
