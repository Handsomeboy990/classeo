// A week of lessons without conflicts, for the seed: every lesson of every
// class is placed so that neither a class nor a teacher is ever in two
// places at once, then the result is checked with the rules the application
// enforces when a slot is edited.

import { describeConflict, findConflicts, slotTimeError, type PlannedSlot } from "../../src/lib/domain/timetable";

// Blocks of the week: two hour blocks at 7 h, 9 h 15 and 15 h (no class on
// Wednesday afternoon), a one hour block at 11 h 15.
const BLOCKS: { key: string; day: number; start: string; end: string; hours: number }[] = [];
for (let day = 1; day <= 5; day++) {
  BLOCKS.push({ key: `${day}-0700`, day, start: "07:00", end: "09:00", hours: 2 });
  BLOCKS.push({ key: `${day}-0915`, day, start: "09:15", end: "11:15", hours: 2 });
  BLOCKS.push({ key: `${day}-1115`, day, start: "11:15", end: "12:15", hours: 1 });
  if (day !== 3) BLOCKS.push({ key: `${day}-1500`, day, start: "15:00", end: "17:00", hours: 2 });
}

// Weekly hours split into blocks: 5 h = 2 + 2 + 1, 3 h = 2 + 1, 2 h = 2.
export const SPLIT: Record<number, number[]> = { 5: [2, 2, 1], 3: [2, 1], 2: [2] };

export type Lesson = { classroomId: string; className: string; assignmentId: string; teacherId: string; subjectCode: string; hours: number };
export type SlotRow = { id: string; assignmentId: string; dayOfWeek: number; startTime: string; endTime: string; room: string };

// `rand` orders the free blocks so the week does not look mechanical. The
// draws happen in the same order as always, so the same generator state
// gives the same week.
export function planWeek(lessons: Lesson[], rand: () => number, newId: () => string): SlotRow[] {
  const busy = new Set<string>();
  const placed = new Map<Lesson, (typeof BLOCKS)[number]>();
  const free = (l: Lesson, b: (typeof BLOCKS)[number]) =>
    b.hours === l.hours && !busy.has(`c:${l.classroomId}:${b.key}`) && !busy.has(`t:${l.teacherId}:${b.key}`) && !busy.has(`s:${l.classroomId}:${l.subjectCode}:${b.day}`);
  const mark = (l: Lesson, b: (typeof BLOCKS)[number], on: boolean) => {
    for (const k of [`c:${l.classroomId}:${b.key}`, `t:${l.teacherId}:${b.key}`, `s:${l.classroomId}:${l.subjectCode}:${b.day}`]) {
      if (on) busy.add(k);
      else busy.delete(k);
    }
  };
  let steps = 0;
  const solve = (): boolean => {
    if (++steps > 200000) throw new Error("Timetable: no conflict free placement found.");
    let best: Lesson | null = null;
    let bestOptions: (typeof BLOCKS)[number][] = [];
    for (const l of lessons) {
      if (placed.has(l)) continue;
      const options = BLOCKS.filter((b) => free(l, b));
      if (!best || options.length < bestOptions.length) {
        best = l;
        bestOptions = options;
        if (!options.length) return false;
      }
    }
    if (!best) return true;
    const order = bestOptions.map((b) => ({ b, r: rand() })).sort((x, y) => x.r - y.r).map((x) => x.b);
    for (const b of order) {
      placed.set(best, b);
      mark(best, b, true);
      if (solve()) return true;
      mark(best, b, false);
      placed.delete(best);
    }
    return false;
  };
  if (!solve()) throw new Error("Timetable: no conflict free placement found.");

  const slots: SlotRow[] = [];
  const planned: PlannedSlot[] = [];
  for (const l of lessons) {
    const b = placed.get(l)!;
    const slotId = newId();
    slots.push({ id: slotId, assignmentId: l.assignmentId, dayOfWeek: b.day, startTime: b.start, endTime: b.end, room: l.subjectCode === "EPS" ? "Terrain de sport" : `Salle ${l.className}` });
    planned.push({ id: slotId, dayOfWeek: b.day, startTime: b.start, endTime: b.end, classroomId: l.classroomId, teacherId: l.teacherId, label: `${l.className} ${l.subjectCode}` });
  }
  for (const s of planned) {
    const timeError = slotTimeError(s);
    if (timeError) throw new Error(`Timetable slot ${s.label}: ${timeError}`);
    const conflicts = findConflicts(s, planned);
    if (conflicts.length) throw new Error(`Timetable conflict for ${s.label}: ${conflicts.map(describeConflict).join(" ")}`);
  }
  return slots;
}
