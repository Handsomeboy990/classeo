export const SCHOOL_STATUSES = ["ACTIVE", "SUSPENDED", "CLOSED"] as const;
export type SchoolStatus = (typeof SCHOOL_STATUSES)[number];

export const SCHOOL_STATUS_LABELS: Record<SchoolStatus, string> = {
  ACTIVE: "En activité",
  SUSPENDED: "Suspendu",
  CLOSED: "Fermé",
};

export const SCHOOL_STATUS_TONES = { ACTIVE: "success", SUSPENDED: "warning", CLOSED: "danger" } as const;

// What each decision does, in the words shown to the authority deciding it.
export const SCHOOL_STATUS_EFFECTS: Record<SchoolStatus, string> = {
  ACTIVE: "L'établissement reprend toutes ses saisies.",
  SUSPENDED: "L'établissement reste consultable mais ne peut plus rien modifier jusqu'à sa réactivation.",
  CLOSED: "L'établissement est fermé : ses données restent consultables, plus aucune modification n'est possible.",
};

export const isSchoolStatus = (v: unknown): v is SchoolStatus => typeof v === "string" && (SCHOOL_STATUSES as readonly string[]).includes(v);
