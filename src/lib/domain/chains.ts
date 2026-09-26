// The two administrative chains of Beninese schooling. Pure, unit tested.
//
// - Nursery and primary schools: MEMP (Ministère des Enseignements Maternel
//   et Primaire), a DDEMP per department, then the circonscriptions
//   scolaires, each led by a chef de circonscription.
// - Secondary general and technical schools: MESTFP (Ministère des
//   Enseignements Secondaire, Technique et de la Formation Professionnelle)
//   and a DDESTFP per department, with no circonscription in between.
//
// A departmental account belongs to one chain and reaches only the schools
// of its cycles; an account without a chain (created before the chains
// existed) keeps reaching every school of its department. A circonscription
// account always belongs to the primary chain.

export type Chain = "PRIMARY" | "SECONDARY";
export type CycleCode = "PRESCHOOL" | "PRIMARY" | "SECONDARY" | "TECHNICAL";

export const CHAIN_CYCLES: Record<Chain, CycleCode[]> = {
  PRIMARY: ["PRESCHOOL", "PRIMARY"],
  SECONDARY: ["SECONDARY", "TECHNICAL"],
};

export function chainOfCycle(cycle: CycleCode): Chain {
  return cycle === "PRESCHOOL" || cycle === "PRIMARY" ? "PRIMARY" : "SECONDARY";
}

export const CHAIN_LABELS: Record<Chain, string> = {
  PRIMARY: "Maternel et primaire",
  SECONDARY: "Secondaire, technique et formation professionnelle",
};

export const MINISTRY_OF: Record<Chain, { short: string; name: string }> = {
  PRIMARY: { short: "MEMP", name: "Ministère des Enseignements Maternel et Primaire" },
  SECONDARY: { short: "MESTFP", name: "Ministère des Enseignements Secondaire, Technique et de la Formation Professionnelle" },
};

// The national level when it covers both chains.
export const MINISTRIES_NAME = "Ministères en charge de l'éducation";

export const DIRECTION_OF: Record<Chain, { short: string; name: string }> = {
  PRIMARY: { short: "DDEMP", name: "Direction départementale des enseignements maternel et primaire" },
  SECONDARY: { short: "DDESTFP", name: "Direction départementale des enseignements secondaire, technique et de la formation professionnelle" },
};

export function ministryName(chain: Chain | null | undefined) {
  return chain ? MINISTRY_OF[chain].name : MINISTRIES_NAME;
}

export type ScopeLevelCode = "NATIONAL" | "DEPARTMENT" | "COMMUNE" | "SCHOOL" | "SELF";

// Cycles an account's territory is limited to, or null for every cycle.
export function scopeCycles(level: ScopeLevelCode, chain: Chain | null | undefined): CycleCode[] | null {
  if (level === "COMMUNE") return CHAIN_CYCLES.PRIMARY;
  if ((level === "DEPARTMENT" || level === "NATIONAL") && chain) return CHAIN_CYCLES[chain];
  return null;
}

// Whether a school of this cycle lies in the cycles of a scope. A limited
// scope and an unknown cycle never match (fails closed).
export function cycleInScope(cycles: readonly CycleCode[] | null | undefined, cycle: CycleCode | null | undefined) {
  if (!cycles) return true;
  return !!cycle && cycles.includes(cycle);
}

// The supervision line of a school, for its page: ministry, departmental
// direction, and the circonscription for nursery and primary schools.
export function supervisionOf(school: { cycle: CycleCode; departmentName: string; communeName: string }) {
  const chain = chainOfCycle(school.cycle);
  return {
    chain,
    ministry: MINISTRY_OF[chain],
    direction: `${DIRECTION_OF[chain].short} ${school.departmentName}`,
    circonscription: chain === "PRIMARY" ? `Circonscription scolaire ${ofPlace(school.communeName)}` : null,
  };
}

// "d'Abomey-Calavi", "de Cotonou".
export function ofPlace(name: string) {
  return /^[AEIOUYÀÂÉÈÊÎÏÔÛ]/i.test(name) ? `d'${name}` : `de ${name}`;
}
