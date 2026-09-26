// End of year decisions of the class council. Pure, unit tested.
//
// Secondary (MESTFP order n° 029 of 2024): passage with a yearly average of
// at least 10/20 (article 60), repetition below (article 62). The exclusion
// thresholds of 2020 (6.50/20 in the first cycle, 7.50/20 in the second)
// are not confirmed for 2024: exclusion is never proposed, the council
// decides it. Primary (MEMP circular n° 1315 of 2020): passage without
// condition at the start of each sub-cycle (CI, CE1, CM1); elsewhere the
// average is a guide, the council judges the mastery reached.

export type CouncilDecision = "PROMOTED" | "REPEAT" | "EXCLUDED";

export const COUNCIL_DECISIONS = ["PROMOTED", "REPEAT", "EXCLUDED"] as const satisfies CouncilDecision[];

export const COUNCIL_DECISION_LABELS: Record<CouncilDecision, string> = {
  PROMOTED: "Passe en classe supérieure",
  REPEAT: "Redouble",
  EXCLUDED: "Exclu",
};

export const COUNCIL_DECISION_TONES = { PROMOTED: "success", REPEAT: "warning", EXCLUDED: "danger" } as const;

// Levels where a primary pupil moves up whatever the average: the first
// year of each sub-cycle (CI-CP, CE1-CE2, CM1-CM2).
const SUB_CYCLE_START = new Set(["CI", "CE1", "CM1"]);

export function proposedDecision(input: { levelCode: string; primary: boolean; yearlyAverage: number | null }): CouncilDecision | null {
  if (input.primary && SUB_CYCLE_START.has(input.levelCode)) return "PROMOTED";
  if (input.yearlyAverage === null) return null;
  return input.yearlyAverage >= 10 ? "PROMOTED" : "REPEAT";
}

// Why a decision is refused, or null. An exclusion needs its reason.
export function decisionError(input: { decision: CouncilDecision; note: string | null }): string | null {
  if (input.decision === "EXCLUDED" && !input.note) return "Motivez l'exclusion dans l'observation du conseil.";
  return null;
}
