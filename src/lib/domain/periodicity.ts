// Evaluation periodicity: trimesters or semesters. Pure, unit tested.
//
// The national calendar (holidays) is the same for every school, in three
// terms. Marks and report cards follow either three trimesters or two
// semesters (MESTFP order n° 029 of 2024, articles 53 and 59): semesters in
// public secondary schools, trimesters in private secondary schools and in
// every nursery and primary school. The ministry sets the rule and may
// override it for a given school.

import { round2 } from "./grades";

export type Periodicity = "TRIMESTER" | "SEMESTER";
export type Sector = "PUBLIC" | "PRIVATE" | "CONFESSIONAL" | "COMMUNITY";
export type Cycle = "PRESCHOOL" | "PRIMARY" | "SECONDARY" | "TECHNICAL";

export function defaultPeriodicity(school: { sector: Sector; cycle: Cycle }): Periodicity {
  return school.sector === "PUBLIC" && (school.cycle === "SECONDARY" || school.cycle === "TECHNICAL") ? "SEMESTER" : "TRIMESTER";
}

export const PERIODICITY_LABELS: Record<Periodicity, string> = {
  TRIMESTER: "Trimestres",
  SEMESTER: "Semestres",
};

// "trimestre" or "semestre", for sentences ("Notes du semestre").
export const PERIOD_WORD: Record<Periodicity, string> = {
  TRIMESTER: "trimestre",
  SEMESTER: "semestre",
};

export const PERIOD_AVERAGE_LABEL: Record<Periodicity, string> = {
  TRIMESTER: "Moyenne trimestrielle",
  SEMESTER: "Moyenne semestrielle",
};

export const PERIOD_COUNT: Record<Periodicity, number> = { TRIMESTER: 3, SEMESTER: 2 };

// The word for a period, from its periodicity when known. Without one
// (a national view mixing both), a neutral word.
export function periodWord(periodicity: Periodicity | null | undefined) {
  return periodicity ? PERIOD_WORD[periodicity] : "période";
}

// "Notes du trimestre", "Notes du semestre", "Notes de la période".
export function ofThePeriod(periodicity: Periodicity | null | undefined) {
  return periodicity ? `du ${PERIOD_WORD[periodicity]}` : "de la période";
}

// "ce trimestre", "ce semestre", "cette période".
export function thisPeriod(periodicity: Periodicity | null | undefined) {
  return periodicity ? `ce ${PERIOD_WORD[periodicity]}` : "cette période";
}

export function periodName(periodicity: Periodicity, order: number) {
  return `${periodicity === "SEMESTER" ? "Semestre" : "Trimestre"} ${order}`;
}

// "Trimestre 2" gives "T2", "Semestre 1" gives "S1"; other names unchanged.
export function shortPeriodName(name: string) {
  return name.replace(/^Trimestre\s+(\d+)$/i, "T$1").replace(/^Semestre\s+(\d+)$/i, "S$1");
}

export function periodsOf<P extends { periodicity: Periodicity }>(periods: P[], periodicity: Periodicity): P[] {
  return periods.filter((p) => p.periodicity === periodicity);
}

// Weight of a period in the yearly average (article 59): the second
// semester counts twice, trimesters count once each.
export function annualWeight(periodicity: Periodicity, order: number) {
  return periodicity === "SEMESTER" ? (order >= 2 ? 2 : 1) : 1;
}

// Yearly average of a student (article 59):
// - semesters: (S1 + 2 x S2) / 3;
// - trimesters: (T1 + T2 + T3) / 3.
// A period without an average is left out with its weight, so a year still
// in progress gives a provisional value. Null when no period has one.
export function yearlyAverage(periods: { periodicity: Periodicity; order: number; average: number | null | undefined }[]): number | null {
  let points = 0;
  let weights = 0;
  for (const p of periods) {
    if (typeof p.average !== "number" || !Number.isFinite(p.average)) continue;
    const w = annualWeight(p.periodicity, p.order);
    points += p.average * w;
    weights += w;
  }
  return weights ? round2(points / weights) : null;
}

// How the yearly average is computed, in words, for method notes.
export const YEARLY_RULE: Record<Periodicity, string> = {
  TRIMESTER: "moyenne des trois trimestres",
  SEMESTER: "(premier semestre + 2 × second semestre) ÷ 3",
};

type DatedPeriod = { startDate: Date; endDate: Date };

// Semesters derived from the three terms of the national calendar, when the
// ministry has not entered them: the first semester runs from the start of
// the first term to the middle of the second one (the February break), the
// second semester from the next day to the end of the last term.
export function semestersFromTerms(terms: DatedPeriod[]): DatedPeriod[] | null {
  if (terms.length < 2) return null;
  const first = terms[0]!;
  const second = terms[1]!;
  const last = terms[terms.length - 1]!;
  const day = 86_400_000;
  const middle = new Date(Math.floor((second.startDate.getTime() + second.endDate.getTime()) / 2 / day) * day);
  return [
    { startDate: first.startDate, endDate: middle },
    { startDate: new Date(middle.getTime() + day), endDate: last.endDate },
  ];
}
