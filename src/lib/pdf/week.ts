// Weekly grid maths of the timetable PDF. Pure, unit tested.

import { toMinutes } from "@/lib/domain/timetable";

export type WeekSlot = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subject: string;
  detail: string | null;
  room: string | null;
  cancelledOn: string | null;
};

export type PlacedSlot = WeekSlot & { lane: number; lanes: number };

// The same lesson given at the same time to several classes (a teacher's
// week) prints once, with the classes and rooms listed together.
export function mergeSimultaneous(slots: WeekSlot[]): WeekSlot[] {
  const merged = new Map<string, WeekSlot>();
  for (const s of slots) {
    const key = `${s.dayOfWeek}|${s.startTime}|${s.endTime}|${s.subject}`;
    const found = merged.get(key);
    if (!found) {
      merged.set(key, { ...s });
      continue;
    }
    const join = (a: string | null, b: string | null) => [...new Set([...(a ? a.split(", ") : []), ...(b ? [b] : [])])].join(", ") || null;
    found.detail = join(found.detail, s.detail);
    found.room = join(found.room, s.room);
    found.cancelledOn = found.cancelledOn && s.cancelledOn ? found.cancelledOn : null;
  }
  return [...merged.values()];
}

// Side by side lanes for lessons that overlap on the same day, so that no
// block hides another. Each group of overlapping lessons shares its width.
export function placeSlots(slots: WeekSlot[]): PlacedSlot[] {
  const out: PlacedSlot[] = [];
  const days = [...new Set(slots.map((s) => s.dayOfWeek))];
  for (const day of days) {
    const list = slots
      .filter((s) => s.dayOfWeek === day)
      .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime) || toMinutes(a.endTime) - toMinutes(b.endTime));
    let group: PlacedSlot[] = [];
    let groupEnd = -1;
    const laneEnds: number[] = [];
    const close = () => {
      const lanes = Math.max(1, ...group.map((g) => g.lane + 1));
      for (const g of group) out.push({ ...g, lanes });
      group = [];
      laneEnds.length = 0;
    };
    for (const s of list) {
      const start = toMinutes(s.startTime);
      const end = toMinutes(s.endTime);
      if (group.length && start >= groupEnd) close();
      let lane = laneEnds.findIndex((e) => e <= start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = end;
      group.push({ ...s, lane, lanes: 1 });
      groupEnd = Math.max(groupEnd, end);
    }
    if (group.length) close();
  }
  return out;
}

export function weeklyMinutes(slots: WeekSlot[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const s of slots) totals.set(s.subject, (totals.get(s.subject) ?? 0) + toMinutes(s.endTime) - toMinutes(s.startTime));
  return totals;
}
