// Free schooling rules. Pure, unit tested.
//
// - Public nursery and primary schools are free since 13 October 2006: they
//   bill nothing, the State funds them through operating grants.
// - In public general secondary schools, girls are exempt from the
//   contribution scolaire from the 2026-2027 school year (interministerial
//   order of 30 July 2026); the State compensates the schools.
// - No pupil may be sent away or kept from an examination for not paying
//   the contribution scolaire (MESTFP order n° 029 of 2024, article 30):
//   report cards, mock exams and transfers never look at invoices.

export type FeeKind = "SCHOOL_CONTRIBUTION" | "APE_DUES" | "OTHER";
type SchoolShape = { sector: "PUBLIC" | "PRIVATE" | "CONFESSIONAL" | "COMMUNITY"; cycle: "PRESCHOOL" | "PRIMARY" | "SECONDARY" | "TECHNICAL" };

export const FEE_KIND_LABELS: Record<FeeKind, string> = {
  SCHOOL_CONTRIBUTION: "Contribution scolaire",
  APE_DUES: "Cotisation de l'association des parents d'élèves",
  OTHER: "Autres frais",
};

export const FREE_PRIMARY_MESSAGE = "La maternelle et le primaire publics sont gratuits depuis 2006 : aucun frais ne peut être facturé aux familles.";

export const GIRLS_EXEMPTION_LABEL = "Exonérée (arrêté du 30 juillet 2026)";

export const NO_BLOCKING_NOTICE =
  "Un reste à payer n'empêche jamais de recevoir le bulletin ni de passer un examen (arrêté n° 029 du 6 mai 2024, article 30).";

// First school year of the girls' exemption: 2026-2027.
const GIRLS_EXEMPTION_FROM = Date.UTC(2026, 7, 1);

export function isFreeSchooling(school: SchoolShape) {
  return school.sector === "PUBLIC" && (school.cycle === "PRESCHOOL" || school.cycle === "PRIMARY");
}

// Why a school may not create a fee, or null when it may.
export function feeCreationError(school: SchoolShape): string | null {
  return isFreeSchooling(school) ? FREE_PRIMARY_MESSAGE : null;
}

// The exemption of a pupil from a fee, as the label shown on the family
// side, or null when the pupil pays it.
export function feeExemption(input: { kind: FeeKind; school: SchoolShape; gender: "F" | "M"; yearStart: Date }): string | null {
  if (input.kind !== "SCHOOL_CONTRIBUTION") return null;
  if (input.school.sector !== "PUBLIC" || input.school.cycle !== "SECONDARY") return null;
  if (input.gender !== "F") return null;
  return input.yearStart.getTime() >= GIRLS_EXEMPTION_FROM ? GIRLS_EXEMPTION_LABEL : null;
}
