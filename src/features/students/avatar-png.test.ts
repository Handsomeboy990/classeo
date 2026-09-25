import { inflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { initialsAvatarPng, initialsOf } from "./avatar-png";

describe("initialsOf", () => {
  it("drops accents and keeps two capitals", () => {
    expect(initialsOf("Sènami", "Hounkpatin")).toBe("SH");
    expect(initialsOf("Éric", "d'Almeida")).toBe("ED");
  });
});

describe("initialsAvatarPng", () => {
  it("is a valid, deterministic PNG with white initials", () => {
    const a = initialsAvatarPng("Sènami", "Hounkpatin", 96);
    expect(a.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(a.readUInt32BE(16)).toBe(96);
    expect(initialsAvatarPng("Sènami", "Hounkpatin", 96).equals(a)).toBe(true);
    // IDAT starts after the signature (8) and the IHDR chunk (25).
    const idatLength = a.readUInt32BE(33);
    const raw = inflateSync(a.subarray(41, 41 + idatLength));
    expect(raw.length).toBe((96 * 3 + 1) * 96);
    expect(raw.includes(Buffer.from([255, 255, 255]))).toBe(true);
  });
});
