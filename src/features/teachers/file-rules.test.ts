import { describe, expect, it } from "vitest";

import { historyByYear, sheetProgress, teacherFileAccess, weekDays, type CourseLine } from "./file-rules";

const a = (id: string, inScope: boolean, isActive = true) => ({ id, inScope, isActive });

describe("teacherFileAccess", () => {
  it("opens the file to the levels above the school, with teacher:view", () => {
    for (const level of ["NATIONAL", "DEPARTMENT", "COMMUNE"] as const)
      expect(teacherFileAccess({ level, canView: true, appointments: [a("t1", true)] })).toEqual({ allowed: true, visibleIds: ["t1"], hiddenActive: 0 });
  });

  it("refuses without teacher:view", () => {
    expect(teacherFileAccess({ level: "NATIONAL", canView: false, appointments: [a("t1", true)] })).toEqual({ allowed: false });
  });

  it("keeps school and family accounts on their own pages", () => {
    expect(teacherFileAccess({ level: "SCHOOL", canView: true, appointments: [a("t1", true)] })).toEqual({ allowed: false });
    expect(teacherFileAccess({ level: "SELF", canView: true, appointments: [a("t1", true)] })).toEqual({ allowed: false });
  });

  it("refuses a person with no appointment in the viewer's territory and chain", () => {
    // A DDEMP and a teacher of secondary schools only: every appointment
    // falls outside the scope filter.
    expect(teacherFileAccess({ level: "DEPARTMENT", canView: true, appointments: [a("t1", false), a("t2", false)] })).toEqual({ allowed: false });
    expect(teacherFileAccess({ level: "DEPARTMENT", canView: true, appointments: [] })).toEqual({ allowed: false });
  });

  it("opens an agent of the State not yet appointed to the ministry only", () => {
    expect(teacherFileAccess({ level: "NATIONAL", canView: true, stateAgent: true, appointments: [] })).toEqual({ allowed: true, visibleIds: [], hiddenActive: 0 });
    expect(teacherFileAccess({ level: "NATIONAL", canView: true, stateAgent: true, appointments: [a("t1", false, false)] })).toEqual({ allowed: true, visibleIds: [], hiddenActive: 0 });
    expect(teacherFileAccess({ level: "DEPARTMENT", canView: true, stateAgent: true, appointments: [] })).toEqual({ allowed: false });
    expect(teacherFileAccess({ level: "NATIONAL", canView: true, stateAgent: false, appointments: [] })).toEqual({ allowed: false });
    // Appointed outside the ministry's chain: not reachable this way.
    expect(teacherFileAccess({ level: "NATIONAL", canView: true, stateAgent: true, appointments: [a("t1", false)] })).toEqual({ allowed: false });
  });

  it("opens on a past appointment in scope", () => {
    expect(teacherFileAccess({ level: "COMMUNE", canView: true, appointments: [a("t1", true, false)] })).toEqual({ allowed: true, visibleIds: ["t1"], hiddenActive: 0 });
  });

  it("shows only the appointments in scope and counts the active ones elsewhere", () => {
    const r = teacherFileAccess({ level: "DEPARTMENT", canView: true, appointments: [a("t1", true), a("t2", false), a("t3", false, false), a("t4", true, false)] });
    expect(r).toEqual({ allowed: true, visibleIds: ["t1", "t4"], hiddenActive: 1 });
  });
});

const y1 = { id: "y1", label: "2025-2026", startDate: new Date("2025-09-15"), isActive: false };
const y2 = { id: "y2", label: "2026-2027", startDate: new Date("2026-09-14"), isActive: true };
const line = (over: Partial<CourseLine>): CourseLine => ({ year: y2, schoolId: "s1", schoolName: "CEG Godomey", classroom: "6e A", subject: "Mathématiques", weeklyHours: 4, ...over });

describe("historyByYear", () => {
  it("returns nothing without courses", () => {
    expect(historyByYear([])).toEqual([]);
  });

  it("groups by year, latest first, then by school in French order", () => {
    const h = historyByYear([
      line({ year: y1, classroom: "5e B" }),
      line({ schoolId: "s2", schoolName: "Collège Émile", classroom: "4e", weeklyHours: 2 }),
      line({ classroom: "6e B", weeklyHours: 3 }),
      line({ classroom: "6e A", subject: "Physique", weeklyHours: 1 }),
    ]);
    expect(h.map((y) => y.year.label)).toEqual(["2026-2027", "2025-2026"]);
    expect(h[0]!.hours).toBe(6);
    expect(h[0]!.schools.map((s) => s.schoolName)).toEqual(["CEG Godomey", "Collège Émile"]);
    expect(h[0]!.schools[0]).toMatchObject({ classes: ["6e B", "6e A"], subjects: ["Mathématiques", "Physique"], hours: 4 });
    expect(h[1]!.schools[0]).toMatchObject({ classes: ["5e B"], hours: 4 });
  });

  it("keeps a class led as main teacher without counting hours", () => {
    const h = historyByYear([line({ year: y1, classroom: "CM2", subject: null, weeklyHours: 0, main: true })]);
    expect(h).toHaveLength(1);
    expect(h[0]!.hours).toBe(0);
    expect(h[0]!.schools[0]).toMatchObject({ classes: ["CM2"], mainClasses: ["CM2"], subjects: [] });
  });

  it("handles any number of years", () => {
    const years = Array.from({ length: 7 }, (_, i) => ({ id: `y${i}`, label: `${2020 + i}-${2021 + i}`, startDate: new Date(`${2020 + i}-09-15`), isActive: i === 6 }));
    const h = historyByYear(years.map((year) => line({ year })));
    expect(h.map((y) => y.year.label)).toEqual(years.map((y) => y.label).reverse());
  });
});

describe("sheetProgress and weekDays", () => {
  it("counts opened, filled and locked sheets", () => {
    expect(sheetProgress([])).toEqual({ total: 0, filled: 0, locked: 0 });
    expect(sheetProgress([{ isLocked: true, grades: 30 }, { isLocked: false, grades: 2 }, { isLocked: false, grades: 0 }])).toEqual({ total: 3, filled: 2, locked: 1 });
  });

  it("names the days of the week in order", () => {
    expect(weekDays([])).toBe("");
    expect(weekDays([3])).toBe("mercredi");
    expect(weekDays([4, 1, 1, 2])).toBe("lundi, mardi et jeudi");
  });
});
