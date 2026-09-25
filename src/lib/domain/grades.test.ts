import { describe, expect, it } from "vitest";

import { generalAverage, mention, rankEntries, subjectAverage, type GradeInput } from "./grades";

const g = (type: GradeInput["type"], value: number | null, maxValue = 20): GradeInput => ({ type, value, maxValue });

describe("subjectAverage", () => {
  it("applies (interrogations + devoir + 2 x composition) / 4", () => {
    const r = subjectAverage("WEIGHTED_STANDARD", [g("INTERROGATION", 12), g("INTERROGATION", 14), g("DEVOIR", 10), g("COMPOSITION", 15)]);
    expect(r.interrogationAverage).toBe(13);
    expect(r.average).toBe(13.25); // (13 + 10 + 30) / 4
  });

  it("normalises grades not marked on 20", () => {
    const r = subjectAverage("WEIGHTED_STANDARD", [g("INTERROGATION", 8, 10)]);
    expect(r.interrogationAverage).toBe(16);
    expect(r.average).toBe(16);
  });

  it("drops a missing component and its weight", () => {
    const r = subjectAverage("WEIGHTED_STANDARD", [g("INTERROGATION", 10), g("COMPOSITION", 16)]);
    expect(r.average).toBe(14); // (10 + 32) / 3
  });

  it("returns null when there is no grade", () => {
    expect(subjectAverage("WEIGHTED_STANDARD", []).average).toBeNull();
    expect(subjectAverage("SIMPLE_AVERAGE", [g("DEVOIR", null)]).average).toBeNull();
  });

  it("supports the simple average and composition only formulas", () => {
    const grades = [g("INTERROGATION", 10), g("DEVOIR", 12), g("COMPOSITION", 17)];
    expect(subjectAverage("SIMPLE_AVERAGE", grades).average).toBe(13);
    expect(subjectAverage("COMPOSITION_ONLY", grades).average).toBe(17);
  });
});

describe("generalAverage", () => {
  it("weights subject averages by coefficient and ignores empty subjects", () => {
    expect(
      generalAverage([
        { average: 12, coefficient: 4 },
        { average: 15, coefficient: 2 },
        { average: null, coefficient: 3 },
      ]),
    ).toBe(13);
    expect(generalAverage([{ average: null, coefficient: 2 }])).toBeNull();
  });
});

describe("rankEntries", () => {
  it("gives tied values the same rank and skips the next ones", () => {
    const entries = [{ v: 12 }, { v: 15 }, { v: 15 }, { v: null }, { v: 9 }];
    const ranks = rankEntries(entries, (e) => e.v);
    expect(entries.map((e) => ranks.get(e))).toEqual([3, 1, 1, null, 4]);
  });
});

describe("mention", () => {
  it("maps averages to a label and a level", () => {
    expect(mention(17)?.level).toBe("excellent");
    expect(mention(10)?.label).toBe("Passable");
    expect(mention(9.99)?.level).toBe("risk");
    expect(mention(null)).toBeNull();
  });
});
