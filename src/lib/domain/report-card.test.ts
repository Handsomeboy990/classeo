import { describe, expect, it } from "vitest";

import type { GradeInput } from "./grades";
import { appreciation, computeReportCards, formatRank, spokenSummary, summarizeClass, type SheetInput } from "./report-card";

const g = (type: GradeInput["type"], value: number | null): GradeInput => ({ type, value, maxValue: 20 });

const students = [
  { enrollmentId: "a", name: "Awa" },
  { enrollmentId: "b", name: "Bio" },
  { enrollmentId: "c", name: "Cica" },
];

const sheets: SheetInput[] = [
  {
    subject: "Mathématiques",
    coefficient: 3,
    teacher: "M. Agossou",
    formula: "WEIGHTED_STANDARD",
    grades: new Map([
      ["a", [g("INTERROGATION", 16), g("DEVOIR", 14), g("COMPOSITION", 15)]], // 15
      ["b", [g("INTERROGATION", 8), g("DEVOIR", 10), g("COMPOSITION", 9)]], // 9
      ["c", [g("COMPOSITION", 15)]], // 15
    ]),
  },
  {
    subject: "Français",
    coefficient: 2,
    teacher: null,
    formula: "SIMPLE_AVERAGE",
    grades: new Map([
      ["a", [g("DEVOIR", 10)]], // 10
      ["b", [g("DEVOIR", 12)]], // 12
    ]),
  },
];

describe("computeReportCards", () => {
  const cards = computeReportCards(students, sheets);
  const byId = new Map(cards.map((c) => [c.enrollmentId, c]));

  it("computes subject averages with each sheet formula", () => {
    expect(byId.get("a")!.lines.map((l) => l.average)).toEqual([15, 10]);
    expect(byId.get("c")!.lines.map((l) => l.average)).toEqual([15, null]);
  });

  it("weights the general average by coefficients and skips missing subjects", () => {
    expect(byId.get("a")!.generalAverage).toBe(13); // (45 + 20) / 5
    expect(byId.get("b")!.generalAverage).toBe(10.2); // (27 + 24) / 5
    expect(byId.get("c")!.generalAverage).toBe(15);
  });

  it("ranks subjects and the general average with ties", () => {
    expect(byId.get("a")!.lines[0]!.rank).toBe(1);
    expect(byId.get("c")!.lines[0]!.rank).toBe(1);
    expect(byId.get("b")!.lines[0]!.rank).toBe(3);
    expect(byId.get("c")!.lines[1]!.rank).toBeNull();
    expect(cards.map((c) => c.rank)).toEqual([2, 3, 1]);
  });

  it("writes an appreciation from the general average", () => {
    expect(byId.get("c")!.appreciation).toBe(appreciation(15));
  });
});

describe("appreciation", () => {
  it("follows the published thresholds", () => {
    expect(appreciation(null)).toBeNull();
    expect(appreciation(14)).toMatch(/^Très bon/);
    expect(appreciation(10)).toMatch(/^Travail satisfaisant/);
    expect(appreciation(9.99)).toMatch(/^Résultats insuffisants/);
  });
});

describe("summarizeClass", () => {
  it("gives class average, extremes and pass rate", () => {
    expect(summarizeClass([12, 8, null, 16])).toEqual({ classAverage: 12, highest: 16, lowest: 8, passRate: 0.6667, ranked: 3 });
  });

  it("handles a class without averages", () => {
    expect(summarizeClass([null]).classAverage).toBeNull();
  });
});

describe("formatRank", () => {
  it("writes French ordinals", () => {
    expect(formatRank(1)).toBe("1er");
    expect(formatRank(3, true)).toBe("3e ex");
    expect(formatRank(null)).toBe("–");
  });
});

describe("spokenSummary", () => {
  it("reads the key facts in French", () => {
    const text = spokenSummary(
      { name: "Awa", generalAverage: 13, rank: 2, classSize: 30, appreciation: "Bien.", lines: [{ subject: "Maths", average: 15 }, { subject: "Français", average: 10 }] },
      "Trimestre 1",
    );
    expect(text).toContain("Moyenne générale : 13,00 sur 20.");
    expect(text).toContain("Rang : 2e sur 30 élèves.");
    expect(text).toContain("Meilleure matière : Maths");
    expect(text).toContain("Matière à renforcer : Français");
  });
});
