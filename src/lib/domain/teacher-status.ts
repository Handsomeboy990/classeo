// Teacher status and payer. Pure, unit tested.
//
// - APE (agent permanent de l'État), ACE (agent contractuel de l'État) and
//   AME (aspirant au métier d'enseignant) are agents of the State: the
//   Ministry of Finance pays them (payslips on bulletinpaie.finances.bj,
//   with their State matricule). The ministry keeps their registry; a school
//   appoints them, never creates them.
// - A vacataire is hired by the school for hours; a private teacher by the
//   promoter of a private school (decree n° 2007-279, articles 51 to 67).
//   The school pays both. Who pays the vacataires of public schools is to
//   be confirmed: the school is recorded here.

export type TeacherStatus = "APE" | "ACE" | "AME" | "VACATAIRE" | "PRIVATE";
export type Payer = "STATE" | "SCHOOL";
type Sector = "PUBLIC" | "PRIVATE" | "CONFESSIONAL" | "COMMUNITY";

export const TEACHER_STATUSES = ["APE", "ACE", "AME", "VACATAIRE", "PRIVATE"] as const satisfies TeacherStatus[];
export const STATE_STATUSES = ["APE", "ACE", "AME"] as const satisfies TeacherStatus[];

export const TEACHER_STATUS_LABELS: Record<TeacherStatus, string> = {
  APE: "Agent permanent de l'État (APE)",
  ACE: "Agent contractuel de l'État (ACE)",
  AME: "Aspirant au métier d'enseignant (AME)",
  VACATAIRE: "Vacataire",
  PRIVATE: "Enseignant du privé",
};

export const TEACHER_STATUS_SHORT: Record<TeacherStatus, string> = { APE: "APE", ACE: "ACE", AME: "AME", VACATAIRE: "Vacataire", PRIVATE: "Privé" };

export const PAYER_LABELS: Record<Payer, string> = {
  STATE: "État, ministère de l'Économie et des Finances",
  SCHOOL: "Établissement",
};

export function isStateStatus(status: TeacherStatus | null | undefined): status is "APE" | "ACE" | "AME" {
  return status === "APE" || status === "ACE" || status === "AME";
}

export function payerOf(status: TeacherStatus | null | undefined): Payer | null {
  if (!status) return null;
  return isStateStatus(status) ? "STATE" : "SCHOOL";
}

// Statuses a school may give when it creates a teacher itself: a public
// school hires vacataires; a private or community school its own teachers
// and vacataires. Agents of the State come from the ministry registry.
export function creatableStatuses(sector: Sector): TeacherStatus[] {
  return sector === "PUBLIC" ? ["VACATAIRE"] : ["PRIVATE", "VACATAIRE"];
}

// The status an appointment takes, or the reason it is refused.
// - An agent of the registry keeps the State status in a public school; in
//   a private school they teach as a vacataire.
// - Anyone else takes a status the school may give.
export function appointmentStatus(input: { chosen: TeacherStatus | null; stateStatus: TeacherStatus | null; sector: Sector }): { ok: true; status: TeacherStatus } | { ok: false; reason: string } {
  if (isStateStatus(input.stateStatus) && input.sector === "PUBLIC") return { ok: true, status: input.stateStatus };
  const allowed = creatableStatuses(input.sector);
  const chosen = input.chosen ?? allowed[0]!;
  if (isStateStatus(chosen))
    return { ok: false, reason: "Les agents de l'État (APE, ACE, AME) sont inscrits au registre par le ministère : recherchez-les au registre pour les nommer." };
  if (!allowed.includes(chosen)) return { ok: false, reason: "Un établissement public n'emploie pas d'enseignant du privé : choisissez vacataire." };
  return { ok: true, status: chosen };
}

// A State matricule: digits and capital letters, 4 to 20 characters.
export const STATE_MATRICULE_PATTERN = /^[0-9A-Z]{4,20}$/;
