import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const fcfa = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
export function formatFcfa(amount: number) {
  return `${fcfa.format(amount)} FCFA`;
}

const number = new Intl.NumberFormat("fr-FR");
export function formatNumber(n: number) {
  return number.format(n);
}

export function formatPercent(ratio: number | null, digits = 0) {
  if (ratio === null || Number.isNaN(ratio)) return "–";
  return `${(ratio * 100).toFixed(digits).replace(".", ",")} %`;
}

export function formatAverage(n: number | null | undefined) {
  if (n === null || n === undefined) return "–";
  return n.toFixed(2).replace(".", ",");
}

// Dates in sentences: "9 octobre 2026", "1er octobre 2026", never a zero
// padded day.
const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Porto-Novo" });
export function formatDate(d: Date | string) {
  return dateFmt.format(typeof d === "string" ? new Date(d) : d).replace(/^1 /, "1er ");
}

// A clock time in French typography: "07:00" gives "7 h", "09:15" gives
// "9 h 15". The "07:00" form stays inside timetable grids only.
export function formatClock(time: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return time;
  const hours = Number(m[1]);
  return m[2] === "00" ? `${hours} h` : `${hours} h ${m[2]}`;
}

const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Porto-Novo" });
// Time of an instant in Benin: "7 h 05", "14 h".
export function formatTime(d: Date | string) {
  return formatClock(timeFmt.format(typeof d === "string" ? new Date(d) : d));
}

const shortDateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Africa/Porto-Novo" });
// "25 sept. à 14 h 05".
export function formatDateTime(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${shortDateFmt.format(date).replace(/^1 /, "1er ")} à ${formatTime(date)}`;
}

// "d'Estelle", "d'Hélène", "de Florentin", "de Hounkpatin": the preposition
// de, elided before a vowel or a mute h. Beninese family names in H are
// pronounced with the h, so only a short list of first names is elided.
const MUTE_H = /^(h[ée]l[èe]ne|herv[ée]|hortense|honor[ée]|hilaire|hugues|huguette|hubert|herman|hermann|henriette|hermione|hippolyte|homère)\b/i;
export function de(word: string) {
  const w = word.trim();
  return /^[aeiouyàâäéèêëîïôöùûüœæ]/i.test(w) || MUTE_H.test(w) ? `d'${w}` : `de ${w}`;
}

// People in French alphabetical order (Adékambi, Adéoti, Adjovi), whatever
// the collation of the database: family name, then first name, accents and
// case ignored. Array.prototype.sort is stable, so equal names keep the order
// the query gave them.
const nameCollator = new Intl.Collator("fr", { sensitivity: "base" });
export type Named = { lastName: string; firstName: string };
export function compareNames(a: Named, b: Named) {
  return nameCollator.compare(a.lastName, b.lastName) || nameCollator.compare(a.firstName, b.firstName);
}
export function sortByName<T>(rows: readonly T[], name: (row: T) => Named): T[] {
  return [...rows].sort((a, b) => compareNames(name(a), name(b)));
}

// "1 fiche", "3 fiches": a count with the right form of its noun, never "(s)".
export function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${formatNumber(count)} ${Math.abs(count) >= 2 ? pluralForm : singular}`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
