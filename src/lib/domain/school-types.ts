// School types and funding. Pure, unit tested.
//
// Beninese law knows public and private schools, private ones being secular
// or confessional (decree n° 2007-279, article 1). The faith of a
// confessional school is a property of the school, not a category; a
// bilingual programme is a special regime of a private school (articles 75
// and 76). Community schools, opened by communities with teachers paid by
// the parents, are kept as their own category. The funding follows from the
// sector and the cycle, never from a free entry.

export type Sector = "PUBLIC" | "PRIVATE" | "CONFESSIONAL" | "COMMUNITY";
export type Cycle = "PRESCHOOL" | "PRIMARY" | "SECONDARY" | "TECHNICAL";
export type Denomination = "CATHOLIC" | "PROTESTANT" | "ISLAMIC" | "FRANCO_ARABIC" | "OTHER";
export type Funding = "STATE_FREE" | "STATE_CONTRIBUTION" | "PRIVATE_FEES" | "COMMUNITY";

export const DENOMINATIONS = ["CATHOLIC", "PROTESTANT", "ISLAMIC", "FRANCO_ARABIC", "OTHER"] as const satisfies Denomination[];

export const DENOMINATION_LABELS: Record<Denomination, string> = {
  CATHOLIC: "Catholique",
  PROTESTANT: "Protestante",
  ISLAMIC: "Islamique",
  FRANCO_ARABIC: "Franco-arabe",
  OTHER: "Autre confession",
};

export const FUNDING_LABELS: Record<Funding, string> = {
  STATE_FREE: "Gratuit, subvention de l'État",
  STATE_CONTRIBUTION: "Budget de l'État et contribution scolaire",
  PRIVATE_FEES: "Frais fixés par le promoteur",
  COMMUNITY: "Participation de la communauté et des parents",
};

export function isPrivate(sector: Sector) {
  return sector === "PRIVATE" || sector === "CONFESSIONAL";
}

export function fundingOf(school: { sector: Sector; cycle: Cycle }): Funding {
  if (school.sector === "PUBLIC") return school.cycle === "PRESCHOOL" || school.cycle === "PRIMARY" ? "STATE_FREE" : "STATE_CONTRIBUTION";
  if (school.sector === "COMMUNITY") return "COMMUNITY";
  return "PRIVATE_FEES";
}

// "Privé confessionnel, catholique, bilingue".
export function schoolTypeLabel(school: { sector: Sector; denomination?: Denomination | null; isBilingual?: boolean }, sectorLabels: Record<Sector, string>) {
  return [
    sectorLabels[school.sector],
    school.sector === "CONFESSIONAL" && school.denomination ? DENOMINATION_LABELS[school.denomination].toLowerCase() : null,
    school.isBilingual ? "bilingue" : null,
  ]
    .filter(Boolean)
    .join(", ");
}

// Checks the private school details against the sector. Returns an error
// message, or null.
export function schoolTypeError(input: { sector: Sector; denomination: Denomination | null; authorizationRef: string | null; promoter: string | null }) {
  if (input.denomination && input.sector !== "CONFESSIONAL") return "Seul un établissement privé confessionnel a une confession.";
  if (input.sector === "PUBLIC" && (input.authorizationRef || input.promoter)) return "L'autorisation d'ouverture et le promoteur concernent les établissements non publics.";
  return null;
}
