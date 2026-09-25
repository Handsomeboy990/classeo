import { describe, expect, it } from "vitest";

import { layoutDay, overlapCount } from "./layout";

const slot = (id: string, startTime: string, endTime: string) => ({ id, dayOfWeek: 5, startTime, endTime });

describe("layoutDay", () => {
  it("keeps separate courses in a single lane", () => {
    const items = layoutDay([slot("b", "09:00", "10:00"), slot("a", "07:00", "09:00")]);
    expect(items).toEqual([
      { kind: "slot", slot: slot("a", "07:00", "09:00"), lane: 0, lanes: 1 },
      { kind: "slot", slot: slot("b", "09:00", "10:00"), lane: 0, lanes: 1 },
    ]);
  });

  it("places two overlapping courses side by side", () => {
    const items = layoutDay([slot("a", "07:00", "09:00"), slot("b", "08:00", "10:00")]);
    expect(items.map((i) => (i.kind === "slot" ? [i.slot.id, i.lane, i.lanes] : i.kind))).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
    ]);
  });

  it("reuses a lane freed before the next course starts", () => {
    const items = layoutDay([slot("a", "07:00", "09:00"), slot("b", "08:00", "10:00"), slot("c", "09:00", "11:00")]);
    expect(items.map((i) => (i.kind === "slot" ? [i.slot.id, i.lane, i.lanes] : i.kind))).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
      ["c", 0, 2],
    ]);
  });

  it("turns three or more simultaneous courses into one conflict cell", () => {
    const items = layoutDay([slot("a", "07:00", "09:00"), slot("b", "07:00", "09:00"), slot("c", "07:00", "09:30"), slot("d", "11:00", "12:00")]);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ kind: "conflict", startTime: "07:00", endTime: "09:30" });
    expect(items[0]!.kind === "conflict" && items[0]!.slots.map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(items[1]).toMatchObject({ kind: "slot", lanes: 1 });
  });
});

describe("overlapCount", () => {
  it("counts the other courses sharing a minute", () => {
    const day = [slot("a", "07:00", "09:00"), slot("b", "08:00", "10:00"), slot("c", "09:00", "10:00")];
    expect(overlapCount(day[0]!, day)).toBe(1);
    expect(overlapCount(day[1]!, day)).toBe(2);
  });
});
