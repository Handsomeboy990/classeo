// Rules of the national school calendar, free of any server import so they
// are unit tested and shared by the form and the actions.

export type PeriodInput = { name: string; startDate: Date; endDate: Date };

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isoToUtc(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

export function toIso(d: Date) {
  return d.toISOString().slice(0, 10);
}

// End of the given day in Benin (UTC+1, no daylight saving): the last
// instant an extension "until" that day holds.
export function endOfBeninDay(iso: string) {
  return new Date(`${iso}T22:59:59.999Z`);
}

// "2026-2027": two consecutive years, the first one the year of the start.
export function yearLabelError(label: string, start: Date) {
  const m = /^(\d{4})-(\d{4})$/.exec(label);
  if (!m) return "Le libellé s'écrit comme 2026-2027.";
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (b !== a + 1) return "Le libellé couvre deux années qui se suivent, comme 2026-2027.";
  if (start.getUTCFullYear() !== a) return `L'année ${label} doit commencer en ${a}.`;
  return null;
}

// A year lasts between six and thirteen months; its periods (two semesters or
// three terms, or more) follow each other inside it without overlapping.
export function calendarError(start: Date, end: Date, periods: PeriodInput[]) {
  if (end <= start) return "La date de fin doit suivre la date de début.";
  const months = (end.getTime() - start.getTime()) / (30.44 * 86_400_000);
  if (months < 6 || months > 13) return "Une année scolaire dure entre 6 et 13 mois.";
  if (periods.length < 2 || periods.length > 4) return "Prévoyez de 2 à 4 périodes (semestres ou trimestres).";
  for (const [i, p] of periods.entries()) {
    const n = i + 1;
    if (!p.name.trim()) return `Donnez un nom à la période ${n}.`;
    if (p.endDate < p.startDate) return `${p.name} : la fin doit suivre le début.`;
    if (p.startDate < start || p.endDate > end) return `${p.name} doit se tenir entre le début et la fin de l'année.`;
    const prev = periods[i - 1];
    if (prev && p.startDate <= prev.endDate) return `${p.name} doit commencer après la fin de ${prev.name}.`;
  }
  const names = new Set(periods.map((p) => p.name.trim().toLowerCase()));
  if (names.size !== periods.length) return "Deux périodes portent le même nom.";
  return null;
}

// Two years may not overlap: every school follows one calendar at a time.
export function overlaps(a: { startDate: Date; endDate: Date }, b: { startDate: Date; endDate: Date }) {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

export type YearStatus = "ACTIVE" | "CLOSED" | "UPCOMING" | "OPEN";

export const YEAR_STATUS_LABELS: Record<YearStatus, string> = {
  ACTIVE: "Année en cours",
  CLOSED: "Close",
  UPCOMING: "À venir",
  OPEN: "Ouverte",
};

export const YEAR_STATUS_TONES = { ACTIVE: "success", CLOSED: "neutral", UPCOMING: "info", OPEN: "warning" } as const;

// closed comes from lib/guards isYearClosed, the single definition used by
// the write guard.
export function yearStatus(year: { isActive: boolean; startDate: Date }, closed: boolean, now = new Date()): YearStatus {
  if (closed) return "CLOSED";
  if (year.isActive) return "ACTIVE";
  return year.startDate > now ? "UPCOMING" : "OPEN";
}

// A date some days from now, as the default value of a date field.
export function isoInDays(days: number, from = new Date()) {
  return toIso(new Date(from.getTime() + days * 86_400_000));
}
