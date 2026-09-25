import { describe, expect, it } from "vitest";

import { frenchParts, MAX_SPOKEN_LENGTH, PART_LENGTH } from "./speech-text";

describe("frenchParts", () => {
  it("keeps a short text whole and ignores blank text", () => {
    expect(frenchParts("  Moyenne : 13,5 sur 20.  Bien ! ")).toEqual(["Moyenne : 13,5 sur 20. Bien !"]);
    expect(frenchParts(" \n ")).toEqual([]);
  });
  it("groups whole sentences into parts of at most PART_LENGTH characters", () => {
    const sentence = "Sènami a obtenu une bonne moyenne ce trimestre en mathématiques.";
    const text = Array.from({ length: 20 }, () => sentence).join(" ");
    const parts = frenchParts(text);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) {
      expect(p.length).toBeLessThanOrEqual(PART_LENGTH);
      expect(p.endsWith(".")).toBe(true);
    }
    expect(parts.join(" ")).toBe(text);
  });
  it("cuts an overlong sentence between clauses and words without losing any", () => {
    const text = `${"un mot, ".repeat(60)}${"encore ".repeat(80)}fin.`;
    const parts = frenchParts(text);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(PART_LENGTH);
    expect(parts.join(" ")).toBe(text.trim());
    const word = "a".repeat(PART_LENGTH * 2 + 5);
    expect(frenchParts(word).join("")).toBe(word);
  });
  it("reads at most MAX_SPOKEN_LENGTH characters", () => {
    const parts = frenchParts("Phrase courte. ".repeat(1000));
    expect(parts.join(" ").length).toBeLessThanOrEqual(MAX_SPOKEN_LENGTH);
  });
});
