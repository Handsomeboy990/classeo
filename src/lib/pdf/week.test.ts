import { describe, expect, it } from "vitest";

import { mergeSimultaneous, placeSlots, weeklyMinutes, type WeekSlot } from "./week";

const slot = (day: number, start: string, end: string, subject: string, detail: string | null = null, room: string | null = null): WeekSlot => ({
  dayOfWeek: day,
  startTime: start,
  endTime: end,
  subject,
  detail,
  room,
  cancelledOn: null,
});

describe("mergeSimultaneous", () => {
  it("prints once a lesson given at the same time to several classes", () => {
    const merged = mergeSimultaneous([slot(1, "08:00", "10:00", "Maths", "6e A", "S1"), slot(1, "08:00", "10:00", "Maths", "6e B", "S2"), slot(2, "08:00", "10:00", "Maths", "6e A", "S1")]);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ detail: "6e A, 6e B", room: "S1, S2" });
  });

  it("keeps different subjects apart", () => {
    expect(mergeSimultaneous([slot(1, "08:00", "10:00", "Maths"), slot(1, "08:00", "10:00", "Anglais")])).toHaveLength(2);
  });
});

describe("placeSlots", () => {
  it("gives one full lane to lessons that do not overlap", () => {
    const placed = placeSlots([slot(1, "08:00", "09:00", "A"), slot(1, "09:00", "10:00", "B")]);
    expect(placed.map((p) => [p.lane, p.lanes])).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });

  it("shares the width between overlapping lessons", () => {
    const placed = placeSlots([slot(1, "08:00", "10:00", "A"), slot(1, "09:00", "11:00", "B"), slot(1, "10:00", "11:00", "C"), slot(1, "14:00", "15:00", "D")]);
    const by = Object.fromEntries(placed.map((p) => [p.subject, [p.lane, p.lanes]]));
    expect(by.A).toEqual([0, 2]);
    expect(by.B).toEqual([1, 2]);
    // C starts when A ends: it reuses the first lane.
    expect(by.C).toEqual([0, 2]);
    expect(by.D).toEqual([0, 1]);
  });
});

describe("weeklyMinutes", () => {
  it("sums the minutes of each subject", () => {
    const totals = weeklyMinutes([slot(1, "08:00", "10:00", "Maths"), slot(3, "07:00", "08:30", "Maths"), slot(2, "08:00", "09:00", "Anglais")]);
    expect(totals.get("Maths")).toBe(210);
    expect(totals.get("Anglais")).toBe(60);
  });
});
