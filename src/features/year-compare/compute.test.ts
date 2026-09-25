import { describe, expect, it } from "vitest";

import { compareYears, trend } from "./compute";

describe("compareYears", () => {
  const rows = [
    { yearId: "y1", childId: "a", enrollments: 100, girls: 40, attendanceRecords: 1000, absences: 100, resultStudents: 90, passed: 45, averageSum: 900 },
    { yearId: "y1", childId: "b", enrollments: 50, girls: 30 },
    { yearId: "y2", childId: "a", enrollments: 120, girls: 60, attendanceRecords: 1000, absences: 50, resultStudents: 100, passed: 70, averageSum: 1100 },
  ];
  const c = compareYears(rows, ["y1", "y2"], [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
    { id: "c", name: "C" },
  ]);
  it("sums each year of the scope", () => {
    expect(c.total.y1!.enrollments).toBe(150);
    expect(c.total.y1!.girlsShare).toBeCloseTo(70 / 150);
    expect(c.total.y1!.passRate).toBeCloseTo(0.5);
    expect(c.total.y2!.meanAverage).toBeCloseTo(11);
    expect(c.total.y2!.absenceRate).toBeCloseTo(0.05);
  });
  it("keeps each child per year, empty when it has no data", () => {
    expect(c.children.find((x) => x.id === "b")!.byYear.y2!.enrollments).toBe(0);
    expect(c.children.find((x) => x.id === "c")!.byYear.y1!.passRate).toBeNull();
    expect(c.children.find((x) => x.id === "a")!.byYear.y2!.passRate).toBeCloseTo(0.7);
  });
});

describe("trend", () => {
  it("judges a change by whether a higher value is better", () => {
    expect(trend("passRate", 0.5, 0.7)).toMatchObject({ direction: "up", judgement: "better" });
    expect(trend("absenceRate", 0.05, 0.1)).toMatchObject({ direction: "up", judgement: "worse" });
    expect(trend("enrollments", 100, 90)).toMatchObject({ direction: "down", judgement: "neutral" });
  });
  it("calls a small change stable and a missing value unknown", () => {
    expect(trend("passRate", 0.5, 0.503)).toMatchObject({ direction: "flat" });
    expect(trend("meanAverage", null, 10)).toBeNull();
  });
});
