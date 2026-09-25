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

// Default periods proposed when the ministry creates a year: three terms
// spread over the year.
export function defaultTerms(start: Date, end: Date): PeriodInput[] {
  const span = end.getTime() - start.getTime();
  const cut = (f: number) => new Date(start.getTime() + Math.round((span * f) / 86_400_000) * 86_400_000);
  const day = 86_400_000;
  const a = cut(1 / 3);
  const b = cut(2 / 3);
  return [
    { name: "Trimestre 1", startDate: start, endDate: a },
    { name: "Trimestre 2", startDate: new Date(a.getTime() + day), endDate: b },
    { name: "Trimestre 3", startDate: new Date(b.getTime() + day), endDate: end },
  ];
}
