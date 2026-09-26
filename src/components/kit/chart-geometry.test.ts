import { describe, expect, it } from "vitest";

import { labelStep, niceTicks, segments, smoothPath } from "./chart-geometry";

describe("niceTicks", () => {
  it("keeps a meaningful scale as it is", () => {
    expect(niceTicks(0, 20)).toEqual([0, 5, 10, 15, 20]);
    expect(niceTicks(0, 100)).toEqual([0, 25, 50, 75, 100]);
  });
  it("rounds an arbitrary maximum up to a readable step", () => {
    expect(niceTicks(0, 2760)).toEqual([0, 1000, 2000, 3000]);
    expect(niceTicks(0, 0.3)).toEqual([0, 0.1, 0.2, 0.3]);
  });
  it("gives a single tick for an empty range", () => {
    expect(niceTicks(5, 5)).toEqual([5]);
  });
});

describe("smoothPath", () => {
  it("passes through every point", () => {
    const d = smoothPath([
      [0, 10],
      [50, 20],
      [100, 5],
    ]);
    expect(d.startsWith("M0.0,10.0")).toBe(true);
    expect(d).toContain(" 50.0,20.0");
    expect(d.endsWith(" 100.0,5.0")).toBe(true);
  });
  it("stays flat between equal values", () => {
    expect(
      smoothPath([
        [0, 10],
        [10, 10],
      ]),
    ).toBe("M0.0,10.0C3.3,10.0 6.7,10.0 10.0,10.0");
  });
});

describe("segments", () => {
  it("breaks the line at missing values", () => {
    expect(segments([1, 2, null, 4])).toEqual([
      { start: 0, values: [1, 2] },
      { start: 3, values: [4] },
    ]);
  });
});

describe("labelStep", () => {
  it("writes every label when there is room, fewer on a narrow chart", () => {
    expect(labelStep(6, 600)).toBe(1);
    expect(labelStep(12, 300)).toBe(3);
  });
});
