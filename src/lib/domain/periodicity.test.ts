import { describe, expect, it } from "vitest";

import { annualWeight, defaultPeriodicity, ofThePeriod, periodsOf, semestersFromTerms, shortPeriodName, yearlyAverage } from "./periodicity";

describe("defaultPeriodicity", () => {
  it("gives semesters to public secondary schools only", () => {
    expect(defaultPeriodicity({ sector: "PUBLIC", cycle: "SECONDARY" })).toBe("SEMESTER");
    expect(defaultPeriodicity({ sector: "PUBLIC", cycle: "TECHNICAL" })).toBe("SEMESTER");
    expect(defaultPeriodicity({ sector: "PRIVATE", cycle: "SECONDARY" })).toBe("TRIMESTER");
    expect(defaultPeriodicity({ sector: "CONFESSIONAL", cycle: "SECONDARY" })).toBe("TRIMESTER");
    expect(defaultPeriodicity({ sector: "PUBLIC", cycle: "PRIMARY" })).toBe("TRIMESTER");
    expect(defaultPeriodicity({ sector: "PUBLIC", cycle: "PRESCHOOL" })).toBe("TRIMESTER");
  });
});

describe("yearlyAverage (arrêté n° 029 of 2024, article 59)", () => {
  it("weights the second semester twice: (S1 + 2 x S2) / 3", () => {
    // (9 + 2 x 12) / 3 = 11
    expect(yearlyAverage([
      { periodicity: "SEMESTER", order: 1, average: 9 },
      { periodicity: "SEMESTER", order: 2, average: 12 },
    ])).toBe(11);
    expect(annualWeight("SEMESTER", 2)).toBe(2);
  });

  it("averages the three trimesters", () => {
    expect(yearlyAverage([
      { periodicity: "TRIMESTER", order: 1, average: 9 },
      { periodicity: "TRIMESTER", order: 2, average: 11 },
      { periodicity: "TRIMESTER", order: 3, average: 13 },
    ])).toBe(11);
  });

  it("differs from a plain mean for semesters", () => {
    // Plain mean would give 10.5 and a pass; the official rule gives 9.67.
    expect(yearlyAverage([
      { periodicity: "SEMESTER", order: 1, average: 12 },
      { periodicity: "SEMESTER", order: 2, average: 8.5 },
    ])).toBe(9.67);
  });

  it("leaves out a period without an average, and returns null without any", () => {
    expect(yearlyAverage([{ periodicity: "SEMESTER", order: 1, average: 14 }, { periodicity: "SEMESTER", order: 2, average: null }])).toBe(14);
    expect(yearlyAverage([{ periodicity: "TRIMESTER", order: 1, average: undefined }])).toBeNull();
    expect(yearlyAverage([])).toBeNull();
  });
});

describe("period names and sets", () => {
  it("shortens period names and words sentences", () => {
    expect(shortPeriodName("Trimestre 3")).toBe("T3");
    expect(shortPeriodName("Semestre 1")).toBe("S1");
    expect(shortPeriodName("Période d'essai")).toBe("Période d'essai");
    expect(ofThePeriod("SEMESTER")).toBe("du semestre");
    expect(ofThePeriod(null)).toBe("de la période");
  });

  it("keeps the periods of one periodicity", () => {
    const all = [
      { id: "t1", periodicity: "TRIMESTER" as const },
      { id: "s1", periodicity: "SEMESTER" as const },
      { id: "t2", periodicity: "TRIMESTER" as const },
    ];
    expect(periodsOf(all, "TRIMESTER").map((p) => p.id)).toEqual(["t1", "t2"]);
  });

  it("derives two semesters from the terms of the 2026-2027 calendar", () => {
    const d = (s: string) => new Date(`${s}T00:00:00Z`);
    const s = semestersFromTerms([
      { startDate: d("2026-09-14"), endDate: d("2026-12-18") },
      { startDate: d("2027-01-04"), endDate: d("2027-03-24") },
      { startDate: d("2027-04-08"), endDate: d("2027-06-25") },
    ])!;
    expect(s[0]!.startDate.toISOString().slice(0, 10)).toBe("2026-09-14");
    expect(s[0]!.endDate.toISOString().slice(0, 10)).toBe("2027-02-12");
    expect(s[1]!.startDate.toISOString().slice(0, 10)).toBe("2027-02-13");
    expect(s[1]!.endDate.toISOString().slice(0, 10)).toBe("2027-06-25");
  });
});
