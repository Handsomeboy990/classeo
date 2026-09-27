import { describe, expect, it } from "vitest";

import { pageWindow, rangeLabel } from "./pagination";

describe("pageWindow", () => {
  it("lists every page up to seven", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("keeps the first pages whole near the start", () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, 4, 5, "gap", 20]);
    expect(pageWindow(4, 20)).toEqual([1, 2, 3, 4, 5, "gap", 20]);
  });

  it("frames the current page in the middle", () => {
    expect(pageWindow(10, 20)).toEqual([1, "gap", 9, 10, 11, "gap", 20]);
  });

  it("keeps the last pages whole near the end", () => {
    expect(pageWindow(17, 20)).toEqual([1, "gap", 16, 17, 18, 19, 20]);
    expect(pageWindow(20, 20)).toEqual([1, "gap", 16, 17, 18, 19, 20]);
  });

  it("never exceeds seven entries and clamps a page out of range", () => {
    for (let p = -2; p <= 30; p++) expect(pageWindow(p, 25).length).toBeLessThanOrEqual(7);
    expect(pageWindow(99, 9)).toEqual([1, "gap", 5, 6, 7, 8, 9]);
  });
});

describe("rangeLabel", () => {
  const f = (n: number) => String(n);
  it("names the rows of the page", () => {
    expect(rangeLabel(2, 20, 356, f)).toBe("21 à 40 sur 356");
    expect(rangeLabel(18, 20, 356, f)).toBe("341 à 356 sur 356");
    expect(rangeLabel(1, 20, 5, f)).toBe("1 à 5 sur 5");
  });
});
