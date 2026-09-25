// Grade rules transposed from the scolarite project (GradeService.php).
// Pure functions, no database access, fully unit tested.

export type Formula = "WEIGHTED_STANDARD" | "SIMPLE_AVERAGE" | "COMPOSITION_ONLY";
export type GradeKind = "INTERROGATION" | "DEVOIR" | "COMPOSITION";

export type GradeInput = { type: GradeKind; value: number | null; maxValue: number };

export type SubjectBreakdown = {
  interrogationAverage: number | null;
  devoirAverage: number | null;
  compositionAverage: number | null;
  average: number | null;
};

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Average of the grades of one kind, each normalised to /20.
function averageOn20(grades: GradeInput[]): number | null {
  const valid = grades.filter((g) => g.value !== null && g.maxValue > 0);
  if (!valid.length) return null;
  const sum = valid.reduce((acc, g) => acc + ((g.value as number) / g.maxValue) * 20, 0);
  return round2(sum / valid.length);
}

// Subject average for a period.
// WEIGHTED_STANDARD: (interrogations average + devoir + 2 x composition) / 4,
// the usual rule in francophone West African schools. A missing component is
// left out and its weight with it.
export function subjectAverage(formula: Formula, grades: GradeInput[]): SubjectBreakdown {
  const interrogationAverage = averageOn20(grades.filter((g) => g.type === "INTERROGATION"));
  const devoirAverage = averageOn20(grades.filter((g) => g.type === "DEVOIR"));
  const compositionAverage = averageOn20(grades.filter((g) => g.type === "COMPOSITION"));

  let average: number | null = null;
  if (formula === "COMPOSITION_ONLY") {
    average = compositionAverage;
  } else if (formula === "SIMPLE_AVERAGE") {
    const values = [interrogationAverage, devoirAverage, compositionAverage].filter((v): v is number => v !== null);
    average = values.length ? round2(values.reduce((a, b) => a + b, 0) / values.length) : null;
  } else {
    const parts: [number | null, number][] = [
      [interrogationAverage, 1],
      [devoirAverage, 1],
      [compositionAverage, 2],
    ];
    let points = 0;
    let weights = 0;
    for (const [value, weight] of parts) {
      if (value === null) continue;
      points += value * weight;
      weights += weight;
    }
    average = weights ? round2(points / weights) : null;
  }
  return { interrogationAverage, devoirAverage, compositionAverage, average };
}

// General average weighted by subject coefficients. Subjects without an
// average do not count, nor does their coefficient.
export function generalAverage(subjects: { average: number | null; coefficient: number }[]): number | null {
  const counted = subjects.filter((s) => s.average !== null && s.coefficient > 0);
  const totalCoef = counted.reduce((a, s) => a + s.coefficient, 0);
  if (!totalCoef) return null;
  return round2(counted.reduce((a, s) => a + (s.average as number) * s.coefficient, 0) / totalCoef);
}

// Competition ranking with ties: 15, 15, 12 ranks 1, 1, 3. Entries without a
// value get no rank.
export function rankEntries<T>(entries: T[], value: (e: T) => number | null): Map<T, number | null> {
  const ranked = entries
    .map((e) => ({ e, v: value(e) }))
    .filter((x): x is { e: T; v: number } => x.v !== null)
    .sort((a, b) => b.v - a.v);
  const result = new Map<T, number | null>(entries.map((e) => [e, null]));
  ranked.forEach((x, i) => {
    const rank = i > 0 && x.v === ranked[i - 1].v ? (result.get(ranked[i - 1].e) as number) : i + 1;
    result.set(x.e, rank);
  });
  return result;
}

export type Mention = { label: string; level: "excellent" | "good" | "average" | "risk" };

// Appreciation shown next to an average, with a level the UI turns into an
// icon, a colour and a word (never colour alone).
export function mention(average: number | null): Mention | null {
  if (average === null) return null;
  if (average >= 16) return { label: "Très bien", level: "excellent" };
  if (average >= 14) return { label: "Bien", level: "good" };
  if (average >= 12) return { label: "Assez bien", level: "good" };
  if (average >= 10) return { label: "Passable", level: "average" };
  return { label: "Insuffisant", level: "risk" };
}

export function isPassing(average: number | null) {
  return average !== null && average >= 10;
}
