// Calendar arithmetic on ISO dates (YYYY-MM-DD), in UTC so that no time
// zone or daylight saving change can move a day.

export type Ymd = { y: number; m: number; d: number };

export function parseIso(value: string | null | undefined): Ymd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const d = Number(match[3]);
  const date = new Date(Date.UTC(y, m, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m || date.getUTCDate() !== d) return null;
  return { y, m, d };
}

export function toIso({ y, m, d }: Ymd) {
  return `${String(y).padStart(4, "0")}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function addDays(iso: string, days: number) {
  const p = parseIso(iso)!;
  const date = new Date(Date.UTC(p.y, p.m, p.d + days));
  return toIso({ y: date.getUTCFullYear(), m: date.getUTCMonth(), d: date.getUTCDate() });
}

export function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

// Same day of the month, clamped to the length of the target month.
export function addMonths(iso: string, months: number) {
  const p = parseIso(iso)!;
  const first = new Date(Date.UTC(p.y, p.m + months, 1));
  const y = first.getUTCFullYear();
  const m = first.getUTCMonth();
  return toIso({ y, m, d: Math.min(p.d, daysInMonth(y, m)) });
}

// Monday is 0, Sunday 6, as calendars are printed in France and Benin.
export function weekday(iso: string) {
  const p = parseIso(iso)!;
  return (new Date(Date.UTC(p.y, p.m, p.d)).getUTCDay() + 6) % 7;
}

// Today in Benin (UTC+1, no daylight saving).
export function todayIso(now = new Date()) {
  const benin = new Date(now.getTime() + 60 * 60 * 1000);
  return toIso({ y: benin.getUTCFullYear(), m: benin.getUTCMonth(), d: benin.getUTCDate() });
}

// "12/03/2026" from "2026-03-12".
export function toDisplay(iso: string) {
  const p = parseIso(iso);
  return p ? `${String(p.d).padStart(2, "0")}/${String(p.m + 1).padStart(2, "0")}/${p.y}` : "";
}

// What people type: 12/03/2026, 12-3-2026, 12.03.26, 12032026 or the ISO
// form. Two digit years are read in this century up to ten years ahead.
export function parseTyped(text: string, now = new Date()): string | null {
  const t = text.trim();
  if (!t) return null;
  if (parseIso(t)) return t;
  let d: number, m: number, y: number;
  const sep = /^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{2}|\d{4})$/.exec(t);
  const packed = /^(\d{2})(\d{2})(\d{4})$/.exec(t);
  if (sep) [d, m, y] = [Number(sep[1]), Number(sep[2]), Number(sep[3])];
  else if (packed) [d, m, y] = [Number(packed[1]), Number(packed[2]), Number(packed[3])];
  else return null;
  if (y < 100) {
    const century = Math.floor(now.getUTCFullYear() / 100) * 100;
    y = century + y > now.getUTCFullYear() + 10 ? century - 100 + y : century + y;
  }
  const iso = toIso({ y, m: m - 1, d });
  return parseIso(iso) ? iso : null;
}

const fullFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" });

// "mardi 3 mars 2026", "dimanche 1er mars 2026".
export function spokenDate(iso: string) {
  const p = parseIso(iso)!;
  return fullFmt.format(new Date(Date.UTC(p.y, p.m, p.d))).replace(/ 1 /, " 1er ");
}

export const MONTHS = Array.from({ length: 12 }, (_, m) => {
  const name = monthFmt.format(new Date(Date.UTC(2026, m, 1)));
  return name.charAt(0).toUpperCase() + name.slice(1);
});

export const WEEKDAYS = [
  ["lun.", "lundi"],
  ["mar.", "mardi"],
  ["mer.", "mercredi"],
  ["jeu.", "jeudi"],
  ["ven.", "vendredi"],
  ["sam.", "samedi"],
  ["dim.", "dimanche"],
] as const;

export function inRange(iso: string, min?: string, max?: string) {
  return (!min || iso >= min) && (!max || iso <= max);
}

// Six weeks from the Monday on or before the first of the month: the grid
// never changes height from one month to the next.
export function monthGrid(y: number, m: number) {
  const first = toIso({ y, m, d: 1 });
  const start = addDays(first, -weekday(first));
  return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
}
