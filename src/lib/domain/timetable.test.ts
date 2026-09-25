import { describe, expect, it } from "vitest";

import { addDays, describeConflict, findConflicts, gridBounds, gridRows, isoDay, overlaps, slotTimeError, weekMonday, type PlannedSlot } from "./timetable";

const slot = (over: Partial<PlannedSlot>): PlannedSlot => ({
  id: "s1",
  dayOfWeek: 1,
  startTime: "08:00",
  endTime: "10:00",
  classroomId: "c6A",
  teacherId: "tKoffi",
  ...over,
});

describe("slotTimeError", () => {
  it("accepts a valid slot", () => {
    expect(slotTimeError({ dayOfWeek: 2, startTime: "07:00", endTime: "09:00" })).toBeNull();
    expect(slotTimeError({ dayOfWeek: 6, startTime: "10:00", endTime: "12:00" })).toBeNull();
  });
  it("refuses an end before or equal to the start", () => {
    expect(slotTimeError({ dayOfWeek: 1, startTime: "10:00", endTime: "09:00" })).toMatch(/après/);
    expect(slotTimeError({ dayOfWeek: 1, startTime: "10:00", endTime: "10:00" })).toMatch(/après/);
  });
  it("refuses malformed times, bad days and out of hours slots", () => {
    expect(slotTimeError({ dayOfWeek: 1, startTime: "8h", endTime: "10:00" })).toMatch(/HH:MM/);
    expect(slotTimeError({ dayOfWeek: 1, startTime: "24:00", endTime: "25:00" })).toMatch(/HH:MM/);
    expect(slotTimeError({ dayOfWeek: 7, startTime: "08:00", endTime: "10:00" })).toMatch(/lundi au samedi/);
    expect(slotTimeError({ dayOfWeek: 1, startTime: "05:00", endTime: "07:00" })).toMatch(/entre/);
    expect(slotTimeError({ dayOfWeek: 1, startTime: "08:00", endTime: "08:10" })).toMatch(/15 minutes/);
  });
  it("keeps Saturday to the morning", () => {
    expect(slotTimeError({ dayOfWeek: 6, startTime: "12:00", endTime: "14:00" })).toMatch(/samedi/);
  });
});

describe("overlaps", () => {
  it("detects shared minutes on the same day only", () => {
    expect(overlaps(slot({}), slot({ startTime: "09:00", endTime: "11:00" }))).toBe(true);
    expect(overlaps(slot({}), slot({ startTime: "08:30", endTime: "09:30" }))).toBe(true);
    expect(overlaps(slot({}), slot({ startTime: "07:00", endTime: "12:00" }))).toBe(true);
    expect(overlaps(slot({}), slot({ dayOfWeek: 2 }))).toBe(false);
  });
  it("lets back to back slots follow each other", () => {
    expect(overlaps(slot({}), slot({ startTime: "10:00", endTime: "11:00" }))).toBe(false);
    expect(overlaps(slot({}), slot({ startTime: "07:00", endTime: "08:00" }))).toBe(false);
  });
});

describe("findConflicts", () => {
  const existing = [
    slot({ id: "a", classroomId: "c6A", teacherId: "tAdjo", label: "Anglais" }),
    slot({ id: "b", classroomId: "c5B", teacherId: "tKoffi", startTime: "10:00", endTime: "12:00", label: "Maths 5e B" }),
  ];

  it("refuses two courses in the same class at the same time", () => {
    const c = findConflicts(slot({ id: undefined, teacherId: "tNew", startTime: "09:00", endTime: "10:00" }), existing);
    expect(c).toHaveLength(1);
    expect(c[0]!.kind).toBe("CLASS");
    expect(describeConflict(c[0]!)).toBe("La classe a déjà un cours le Lundi de 08:00 à 10:00 (Anglais).");
  });

  it("refuses a teacher teaching two classes at the same time", () => {
    const c = findConflicts(slot({ id: undefined, classroomId: "c4C", startTime: "11:00", endTime: "12:00" }), existing);
    expect(c.map((x) => x.kind)).toEqual(["TEACHER"]);
    expect(describeConflict(c[0]!)).toMatch(/^L'enseignant a déjà un cours/);
  });

  it("ignores the slot being edited and unassigned teachers", () => {
    expect(findConflicts(slot({ id: "a", teacherId: "tAdjo" }), existing)).toEqual([]);
    expect(findConflicts(slot({ id: undefined, classroomId: "c4C", teacherId: null, startTime: "10:00", endTime: "11:00" }), existing)).toEqual([]);
  });

  it("accepts a free slot", () => {
    expect(findConflicts(slot({ id: undefined, dayOfWeek: 3 }), existing)).toEqual([]);
  });
});

describe("grid", () => {
  it("covers at least 07:00 to 18:00 and extends to the slots", () => {
    expect(gridBounds([])).toEqual({ start: 420, end: 1080, rows: 44 });
    expect(gridBounds([{ dayOfWeek: 1, startTime: "06:45", endTime: "18:30" }])).toEqual({ start: 360, end: 1140, rows: 52 });
  });
  it("maps a slot to grid lines", () => {
    expect(gridRows({ dayOfWeek: 1, startTime: "07:00", endTime: "09:00" }, 420)).toEqual({ from: 1, to: 9 });
    expect(gridRows({ dayOfWeek: 1, startTime: "09:15", endTime: "11:15" }, 420)).toEqual({ from: 10, to: 18 });
  });
});

describe("weeks", () => {
  it("finds the Monday of a week", () => {
    expect(weekMonday(new Date("2026-09-25T15:00:00Z")).toISOString().slice(0, 10)).toBe("2026-09-21");
    expect(weekMonday(new Date("2026-09-27T15:00:00Z")).toISOString().slice(0, 10)).toBe("2026-09-21");
    expect(weekMonday(new Date("2026-09-21T00:00:00Z")).toISOString().slice(0, 10)).toBe("2026-09-21");
    expect(addDays(new Date("2026-09-21T00:00:00Z"), 5).toISOString().slice(0, 10)).toBe("2026-09-26");
    expect(isoDay(new Date("2026-09-25T00:00:00Z"))).toBe(5);
  });
});
