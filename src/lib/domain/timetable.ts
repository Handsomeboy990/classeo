// Timetable rules: slot validity and conflict detection, weekly grid maths.
// Pure functions only. Times are "HH:MM" strings, days 1 (Monday) to 6
// (Saturday, morning only).

export const DAYS = [
  { value: 1, label: "Lundi", short: "Lun." },
  { value: 2, label: "Mardi", short: "Mar." },
  { value: 3, label: "Mercredi", short: "Mer." },
  { value: 4, label: "Jeudi", short: "Jeu." },
  { value: 5, label: "Vendredi", short: "Ven." },
  { value: 6, label: "Samedi", short: "Sam." },
] as const;

export const DAY_START = "06:30";
export const DAY_END = "19:00";
export const SATURDAY_END = "13:00";

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function toMinutes(time: string): number {
  const m = TIME.exec(time);
  if (!m) return Number.NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function fromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export type SlotTimes = { dayOfWeek: number; startTime: string; endTime: string };

// Returns the reason a slot is invalid, or null.
export function slotTimeError(slot: SlotTimes): string | null {
  if (!Number.isInteger(slot.dayOfWeek) || slot.dayOfWeek < 1 || slot.dayOfWeek > 6) return "Choisissez un jour du lundi au samedi.";
  const start = toMinutes(slot.startTime);
  const end = toMinutes(slot.endTime);
  if (Number.isNaN(start) || Number.isNaN(end)) return "Saisissez les heures au format HH:MM.";
  if (end <= start) return "L'heure de fin doit être après l'heure de début.";
  if (end - start < 15) return "Un cours dure au moins 15 minutes.";
  if (start < toMinutes(DAY_START) || end > toMinutes(DAY_END)) return `Les cours ont lieu entre ${DAY_START} et ${DAY_END}.`;
  if (slot.dayOfWeek === 6 && end > toMinutes(SATURDAY_END)) return `Le samedi, les cours se terminent au plus tard à ${SATURDAY_END}.`;
  return null;
}

// Two slots overlap when they share at least one minute on the same day.
// Back to back slots (08:00 to 09:00, then 09:00 to 10:00) do not.
export function overlaps(a: SlotTimes, b: SlotTimes) {
  return a.dayOfWeek === b.dayOfWeek && toMinutes(a.startTime) < toMinutes(b.endTime) && toMinutes(b.startTime) < toMinutes(a.endTime);
}

export type PlannedSlot = SlotTimes & {
  id?: string;
  classroomId: string;
  teacherId: string | null;
  label?: string;
};

export type SlotConflict = { kind: "CLASS" | "TEACHER"; slot: PlannedSlot };

// Conflicts of a candidate slot against the existing ones. The slot being
// edited (same id) is ignored. A class cannot have two courses at once, and a
// teacher cannot teach two courses at once, even in different classes.
export function findConflicts(candidate: PlannedSlot, existing: PlannedSlot[]): SlotConflict[] {
  const out: SlotConflict[] = [];
  for (const slot of existing) {
    if (candidate.id && slot.id === candidate.id) continue;
    if (!overlaps(candidate, slot)) continue;
    if (slot.classroomId === candidate.classroomId) out.push({ kind: "CLASS", slot });
    else if (candidate.teacherId && slot.teacherId === candidate.teacherId) out.push({ kind: "TEACHER", slot });
  }
  return out;
}

export function describeConflict(c: SlotConflict): string {
  const when = `${DAYS[c.slot.dayOfWeek - 1]?.label ?? ""} de ${c.slot.startTime} à ${c.slot.endTime}`;
  const what = c.slot.label ? ` (${c.slot.label})` : "";
  return c.kind === "CLASS"
    ? `La classe a déjà un cours le ${when}${what}.`
    : `L'enseignant a déjà un cours le ${when}${what}.`;
}

// Rows of the weekly grid, in 15 minute units, from the first hour to the last
// hour covered by the slots (at least 07:00 to 18:00).
export const GRID_STEP = 15;

export function gridBounds(slots: SlotTimes[]) {
  let start = toMinutes("07:00");
  let end = toMinutes("18:00");
  for (const s of slots) {
    start = Math.min(start, toMinutes(s.startTime));
    end = Math.max(end, toMinutes(s.endTime));
  }
  start = Math.floor(start / 60) * 60;
  end = Math.ceil(end / 60) * 60;
  return { start, end, rows: (end - start) / GRID_STEP };
}

// Grid rows (1 based, CSS grid lines) occupied by a slot.
export function gridRows(slot: SlotTimes, gridStart: number) {
  const from = Math.floor((toMinutes(slot.startTime) - gridStart) / GRID_STEP) + 1;
  const to = Math.ceil((toMinutes(slot.endTime) - gridStart) / GRID_STEP) + 1;
  return { from, to };
}

// Monday of the week containing the date, as a UTC midnight date.
export function weekMonday(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const iso = (d.getUTCDay() + 6) % 7; // Monday 0 ... Sunday 6
  d.setUTCDate(d.getUTCDate() - iso);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// Day of week 1 (Monday) to 7 (Sunday).
export function isoDay(date: Date) {
  return ((date.getUTCDay() + 6) % 7) + 1;
}
