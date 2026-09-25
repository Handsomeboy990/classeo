import { describe, expect, it } from "vitest";

import { addDays, attendanceRate, countStatuses, isIsoDate, isWeekend, newAbsences, schoolWeek, todayIso } from "./attendance";

describe("attendanceRate", () => {
  it("counts presences and lateness over all records", () => {
    expect(attendanceRate({ PRESENT: 7, LATE: 1, ABSENT: 1, EXCUSED: 1 })).toBe(0.8);
  });

  it("treats an excused absence as an absence", () => {
    expect(attendanceRate({ PRESENT: 1, EXCUSED: 1 })).toBe(0.5);
  });

  it("returns null when nothing was recorded", () => {
    expect(attendanceRate({})).toBeNull();
  });
});

describe("countStatuses", () => {
  it("groups statuses", () => {
    expect(countStatuses(["PRESENT", "ABSENT", "PRESENT"])).toEqual({ PRESENT: 2, ABSENT: 1 });
  });
});

describe("newAbsences", () => {
  it("keeps only absences not already recorded", () => {
    const previous = new Map([
      ["a", "ABSENT" as const],
      ["b", "PRESENT" as const],
    ]);
    const next = [
      { enrollmentId: "a", status: "ABSENT" as const },
      { enrollmentId: "b", status: "ABSENT" as const },
      { enrollmentId: "c", status: "ABSENT" as const },
      { enrollmentId: "d", status: "LATE" as const },
    ];
    expect(newAbsences(next, previous).map((r) => r.enrollmentId)).toEqual(["b", "c"]);
  });
});

describe("dates", () => {
  it("validates calendar dates", () => {
    expect(isIsoDate("2026-09-25")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("25/09/2026")).toBe(false);
  });

  it("gives today in Benin time", () => {
    // 23:30 UTC on the 24th is already 00:30 on the 25th in Porto-Novo.
    expect(todayIso(new Date("2026-09-24T23:30:00Z"))).toBe("2026-09-25");
  });

  it("finds the school week, Monday to Friday", () => {
    expect(schoolWeek("2026-09-25")).toEqual({ from: "2026-09-21", to: "2026-09-25" });
    expect(schoolWeek("2026-09-27")).toEqual({ from: "2026-09-21", to: "2026-09-25" });
    expect(schoolWeek("2026-09-21")).toEqual({ from: "2026-09-21", to: "2026-09-25" });
  });

  it("adds days across months and spots weekends", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(isWeekend("2026-09-26")).toBe(true);
    expect(isWeekend("2026-09-25")).toBe(false);
  });
});
