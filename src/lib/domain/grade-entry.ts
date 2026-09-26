// Grade entry rules shared by the entry grid (client) and the save action
// (server): which columns a sheet has, how a typed value is read, and how
// complete a sheet is. Pure functions, fully unit tested.

import type { GradeKind } from "./grades";

export type EvaluationColumn = { key: string; type: GradeKind; sequence: number; label: string; short: string };

export function columnKey(type: GradeKind, sequence: number) {
  return `${type}:${sequence}`;
}

// Interrogations écrites 1..n, then devoirs surveillés, then compositions,
// as on paper sheets. The names are those of MESTFP order n° 029 of 2024.
export function evaluationColumns(sheet: { interrogationCount: number; devoirCount: number; compositionCount: number }): EvaluationColumn[] {
  const cols: EvaluationColumn[] = [];
  const add = (type: GradeKind, count: number, label: string, short: string) => {
    for (let i = 1; i <= count; i++)
      cols.push({ key: columnKey(type, i), type, sequence: i, label: count > 1 ? `${label} ${i}` : label, short: count > 1 ? `${short}${i}` : short });
  };
  add("INTERROGATION", sheet.interrogationCount, "Interrogation écrite", "IE");
  add("DEVOIR", sheet.devoirCount, "Devoir surveillé", "DS");
  add("COMPOSITION", sheet.compositionCount, "Composition", "C");
  // Interrogations are always numbered, even when there is only one.
  return cols.map((c) => (c.type === "INTERROGATION" && sheet.interrogationCount === 1 ? { ...c, label: "Interrogation écrite 1", short: "IE1" } : c));
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
  OFFICIAL_2024: "Officielle (arrêté n° 029 du 6 mai 2024) : (moyenne des interrogations écrites + chaque devoir surveillé) ÷ nombre de notes",
  WEIGHTED_STANDARD: "Composition pondérée (usage d'établissement) : (moyenne des interrogations + moyenne des devoirs + 2 × composition) ÷ 4",
  SIMPLE_AVERAGE: "Moyenne simple des interrogations, devoirs et compositions (usage d'établissement)",
  COMPOSITION_ONLY: "Composition uniquement (usage d'établissement)",
} as const;

export const FORMULA_SHORT = {
  OFFICIAL_2024: "Officielle",
  WEIGHTED_STANDARD: "Composition pondérée",
  SIMPLE_AVERAGE: "Moyenne simple",
  COMPOSITION_ONLY: "Composition seule",
} as const;

export type SheetConfig = { formula: keyof typeof FORMULA_LABELS; interrogationCount: number; devoirCount: number; compositionCount: number };

// Checks a sheet configuration against the national rule (article 53: at
// least two interrogations and two devoirs surveillés per period is the
// expected minimum, the form proposes it by default) and the school's
// options. Returns an error message, or null.
export function sheetConfigError(config: SheetConfig, school: { allowsComposition: boolean }): string | null {
  const composition = config.formula !== "OFFICIAL_2024";
  if (composition && !school.allowsComposition)
    return "Votre établissement applique la formule officielle. Les compositions s'activent dans les paramètres de l'établissement.";
  if (!composition && config.compositionCount > 0) return "La formule officielle ne compte pas de composition : mettez le nombre de compositions à 0.";
  if (config.formula === "COMPOSITION_ONLY" && config.compositionCount === 0) return "Prévoyez au moins une composition pour cette formule.";
  if (config.formula === "OFFICIAL_2024" && config.interrogationCount + config.devoirCount === 0) return "Prévoyez au moins une interrogation écrite ou un devoir surveillé.";
  return null;
}

// Default configuration of a new sheet: two interrogations écrites and two
// devoirs surveillés (article 53), or the school's composition practice.
export function defaultSheetConfig(school: { allowsComposition: boolean }): SheetConfig {
  return school.allowsComposition
    ? { formula: "WEIGHTED_STANDARD", interrogationCount: 2, devoirCount: 1, compositionCount: 1 }
    : { formula: "OFFICIAL_2024", interrogationCount: 2, devoirCount: 2, compositionCount: 0 };
}
