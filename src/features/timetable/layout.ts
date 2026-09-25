import { overlaps, toMinutes, type SlotTimes } from "@/lib/domain/timetable";

// Placement of one day's courses in the weekly grid. Courses that overlap
// (a teacher shown in several classes at once, a data entry mistake) are
// never drawn on top of each other:
// - up to MAX_LANES at once, they sit side by side in the slot;
// - beyond, the whole group becomes one "conflict" cell listing them.

export const MAX_LANES = 2;

export type DayItem<T extends SlotTimes> =
  | { kind: "slot"; slot: T; lane: number; lanes: number }
  | { kind: "conflict"; slots: T[]; startTime: string; endTime: string };

export function layoutDay<T extends SlotTimes>(slots: T[]): DayItem<T>[] {
  const sorted = [...slots].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime) || toMinutes(a.endTime) - toMinutes(b.endTime));

  // Groups of courses linked by overlaps (a chain counts as one group).
  const groups: { slots: T[]; end: number }[] = [];
  for (const s of sorted) {
    const last = groups.at(-1);
    if (last && toMinutes(s.startTime) < last.end) {
      last.slots.push(s);
      last.end = Math.max(last.end, toMinutes(s.endTime));
    } else groups.push({ slots: [s], end: toMinutes(s.endTime) });
  }

  const items: DayItem<T>[] = [];
  for (const g of groups) {
    // Greedy lanes: each course takes the first lane free at its start.
    const laneEnds: number[] = [];
    const placed = g.slots.map((slot) => {
      const start = toMinutes(slot.startTime);
      let lane = laneEnds.findIndex((end) => end <= start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = toMinutes(slot.endTime);
      return { slot, lane };
    });
    const lanes = laneEnds.length;
    if (lanes <= MAX_LANES) {
      for (const p of placed) items.push({ kind: "slot", slot: p.slot, lane: p.lane, lanes });
    } else {
      const first = g.slots[0]!;
      const endTime = g.slots.reduce((e, s) => (toMinutes(s.endTime) > toMinutes(e) ? s.endTime : e), first.endTime);
      items.push({ kind: "conflict", slots: g.slots, startTime: first.startTime, endTime });
    }
  }
  return items;
}

// How many other courses of the same day overlap this one.
export function overlapCount<T extends SlotTimes>(slot: T, day: T[]) {
  return day.filter((o) => o !== slot && overlaps(o, slot)).length;
}
