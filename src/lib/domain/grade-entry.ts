// Grade entry rules shared by the entry grid (client) and the save action
// (server): which columns a sheet has, how a typed value is read, and how
// complete a sheet is. Pure functions, fully unit tested.

import type { GradeKind } from "./grades";

export type EvaluationColumn = { key: string; type: GradeKind; sequence: number; label: string; short: string };

export function columnKey(type: GradeKind, sequence: number) {
  return `${type}:${sequence}`;
}

// Interrogations 1..n, then devoirs, then compositions, as on paper sheets.
export function evaluationColumns(sheet: { interrogationCount: number; devoirCount: number; compositionCount: number }): EvaluationColumn[] {
  const cols: EvaluationColumn[] = [];
  const add = (type: GradeKind, count: number, label: string, short: string) => {
    for (let i = 1; i <= count; i++)
      cols.push({ key: columnKey(type, i), type, sequence: i, label: count > 1 ? `${label} ${i}` : label, short: count > 1 ? `${short}${i}` : short });
  };
  add("INTERROGATION", sheet.interrogationCount, "Interrogation", "I");
  add("DEVOIR", sheet.devoirCount, "Devoir", "D");
  add("COMPOSITION", sheet.compositionCount, "Composition", "C");
  // Interrogations are always numbered, even when there is only one.
  return cols.map((c) => (c.type === "INTERROGATION" && sheet.interrogationCount === 1 ? { ...c, label: "Interrogation 1", short: "I1" } : c));
}

export type ParsedGrade = { ok: true; value: number | null } | { ok: false; error: string };

// Reads what a teacher typed: empty means no grade, a comma or a dot is the
// decimal separator, at most two decimals, between 0 and the maximum.
export function parseGradeValue(raw: string, max = 20): ParsedGrade {
  const text = raw.trim().replace(",", ".");
  if (text === "") return { ok: true, value: null };
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(text)) return { ok: false, error: `Saisissez une note entre 0 et ${max}, par exemple 12,5.` };
  const value = Number(text);
  if (value < 0 || value > max) return { ok: false, error: `La note doit être comprise entre 0 et ${max}.` };
  return { ok: true, value };
}

// Share of the expected grades already entered, between 0 and 1.
export function sheetProgress(entered: number, students: number, evaluations: number): number {
  const expected = students * evaluations;
  if (expected <= 0) return 0;
  return Math.min(1, entered / expected);
}

export const FORMULA_LABELS = {
  WEIGHTED_STANDARD: "Standard : (moyenne des interrogations + devoir + 2 × composition) ÷ 4",
  SIMPLE_AVERAGE: "Moyenne simple des interrogations, devoirs et compositions",
  COMPOSITION_ONLY: "Composition uniquement",
} as const;

export const FORMULA_SHORT = {
  WEIGHTED_STANDARD: "Standard",
  SIMPLE_AVERAGE: "Moyenne simple",
  COMPOSITION_ONLY: "Composition seule",
} as const;
