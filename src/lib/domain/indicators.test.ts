import { describe, expect, it } from "vitest";

import { computeIndicators, emptyCounts, ratio, sortByIndicator, sumCounts, yearlyAverage } from "./indicators";

describe("ratio", () => {
  it("returns null on an empty denominator", () => {
    expect(ratio(3, 0)).toBeNull();
    expect(ratio(1, 4)).toBe(0.25);
  });
});

describe("computeIndicators", () => {
  it("derives every ratio from the same counts", () => {
    const i = computeIndicators({
      ...emptyCounts(),
      enrollments: 120,
      girls: 60,
      disabled: 6,
      teachers: 4,
      classes: 3,
      attendanceRecords: 200,
      absences: 10,
      resultStudents: 100,
      passed: 70,
      averageSum: 1150,
    });
    expect(i.girlsShare).toBe(0.5);
    expect(i.disabledShare).toBe(0.05);
    expect(i.studentsPerTeacher).toBe(30);
    expect(i.averageClassSize).toBe(40);
    expect(i.absenceRate).toBe(0.05);
    expect(i.passRate).toBe(0.7);
    expect(i.meanAverage).toBe(11.5);
  });

  it("leaves indicators without data empty instead of zero", () => {
    const i = computeIndicators(emptyCounts());
    expect(i.passRate).toBeNull();
    expect(i.absenceRate).toBeNull();
    expect(i.studentsPerTeacher).toBeNull();
  });

  it("gives the same national figure as the sum of its parts", () => {
    const a = { ...emptyCounts(), resultStudents: 10, passed: 9, averageSum: 130 };
    const b = { ...emptyCounts(), resultStudents: 30, passed: 12, averageSum: 270 };
    const total = computeIndicators(sumCounts([a, b]));
    expect(total.passRate).toBe(21 / 40);
    expect(total.meanAverage).toBe(10);
  });
});

describe("yearlyAverage", () => {
  it("averages the published terms and ignores missing ones", () => {
    expect(yearlyAverage([9, 11, null])).toBe(10);
    expect(yearlyAverage([null, undefined])).toBeNull();
  });
});

describe("sortByIndicator", () => {
  const row = (name: string, passed: number, total: number) => ({ name, indicators: computeIndicators({ ...emptyCounts(), passed, resultStudents: total }) });
  const rows = [row("Borgou", 5, 10), row("Alibori", 0, 0), row("Zou", 8, 10), row("Mono", 5, 10)];

  it("sorts descending with missing values last", () => {
    expect(sortByIndicator(rows, "passRate").map((r) => r.name)).toEqual(["Zou", "Borgou", "Mono", "Alibori"]);
  });
  it("keeps missing values last when ascending", () => {
    expect(sortByIndicator(rows, "passRate", "asc").map((r) => r.name)).toEqual(["Borgou", "Mono", "Zou", "Alibori"]);
  });
});
