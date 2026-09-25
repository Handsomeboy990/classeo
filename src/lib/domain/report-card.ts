// Report card computation: from the grade sheets of a class for one period to
// one card per student, with subject averages, coefficients, ranks with ties
// and an appreciation. Transposed from GradeService::recalculateStudentReportCard
// and the rank update of the scolarite project. Pure, fully unit tested.

import { generalAverage, rankEntries, round2, subjectAverage, type Formula, type GradeInput } from "./grades";

export type SheetInput = {
  subject: string;
  coefficient: number;
  teacher: string | null;
  formula: Formula;
  // Grades of the sheet, keyed by enrollment.
  grades: Map<string, GradeInput[]>;
};

export type StudentInput = { enrollmentId: string; name: string };

export type ReportLine = {
  subject: string;
  coefficient: number;
  average: number | null;
  rank: number | null;
  teacher: string | null;
};

export type ComputedCard = {
  enrollmentId: string;
  name: string;
  lines: ReportLine[];
  generalAverage: number | null;
  rank: number | null;
  appreciation: string | null;
};

// Same wording as the report cards already published for 2025-2026.
export function appreciation(average: number | null): string | null {
  if (average === null) return null;
  if (average >= 14) return "Très bon travail, continuez ainsi.";
  if (average >= 10) return "Travail satisfaisant, peut mieux faire.";
  return "Résultats insuffisants, un soutien est recommandé.";
}

export function computeReportCards(students: StudentInput[], sheets: SheetInput[]): ComputedCard[] {
  const cards: ComputedCard[] = students.map((s) => {
    const lines = sheets.map((sheet) => ({
      subject: sheet.subject,
      coefficient: sheet.coefficient,
      teacher: sheet.teacher,
      average: subjectAverage(sheet.formula, sheet.grades.get(s.enrollmentId) ?? []).average,
      rank: null as number | null,
    }));
    const avg = generalAverage(lines);
    return { enrollmentId: s.enrollmentId, name: s.name, lines, generalAverage: avg, rank: null, appreciation: appreciation(avg) };
  });

  sheets.forEach((_, i) => {
    const ranks = rankEntries(cards, (c) => c.lines[i]!.average);
    for (const c of cards) c.lines[i]!.rank = ranks.get(c) ?? null;
  });
  const ranks = rankEntries(cards, (c) => c.generalAverage);
  for (const c of cards) c.rank = ranks.get(c) ?? null;
  return cards;
}

export type ClassSummary = {
  classAverage: number | null;
  highest: number | null;
  lowest: number | null;
  passRate: number | null; // share of ranked students at or above 10
  ranked: number;
};

export function summarizeClass(averages: (number | null)[]): ClassSummary {
  const values = averages.filter((v): v is number => v !== null);
  if (!values.length) return { classAverage: null, highest: null, lowest: null, passRate: null, ranked: 0 };
  return {
    classAverage: round2(values.reduce((a, b) => a + b, 0) / values.length),
    highest: Math.max(...values),
    lowest: Math.min(...values),
    passRate: Math.round((values.filter((v) => v >= 10).length / values.length) * 10000) / 10000,
    ranked: values.length,
  };
}

// "1er", "2e": French ordinal for ranks, "ex" for a tie.
export function formatRank(rank: number | null, tied = false): string {
  if (rank === null) return "–";
  return `${rank}${rank === 1 ? "er" : "e"}${tied ? " ex" : ""}`;
}

// A short text summary for the voice reader: average, mention, rank, then
// the weakest and strongest subjects.
export function spokenSummary(card: { name: string; generalAverage: number | null; rank: number | null; classSize: number; appreciation: string | null; lines: { subject: string; average: number | null }[] }, period: string): string {
  const fmt = (n: number) => n.toFixed(2).replace(".", ",");
  const parts = [`Bulletin de ${card.name}, ${period}.`];
  if (card.generalAverage === null) {
    parts.push("Aucune moyenne n'a encore été calculée.");
    return parts.join(" ");
  }
  parts.push(`Moyenne générale : ${fmt(card.generalAverage)} sur 20.`);
  if (card.rank !== null) parts.push(`Rang : ${card.rank}${card.rank === 1 ? "er" : "e"} sur ${card.classSize} élèves.`);
  const graded = card.lines.filter((l): l is { subject: string; average: number } => l.average !== null);
  if (graded.length) {
    const best = graded.reduce((a, b) => (b.average > a.average ? b : a));
    const worst = graded.reduce((a, b) => (b.average < a.average ? b : a));
    parts.push(`Meilleure matière : ${best.subject}, ${fmt(best.average)}.`);
    if (worst !== best) parts.push(`Matière à renforcer : ${worst.subject}, ${fmt(worst.average)}.`);
  }
  if (card.appreciation) parts.push(`Appréciation : ${card.appreciation}`);
  return parts.join(" ");
}
