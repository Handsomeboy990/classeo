// Rules of the pieces families send to the school. Pure, unit tested; the
// server actions and the file route apply them after their scoped queries.

export type FamilyDocKind = "ENROLLMENT" | "ABSENCE" | "MEDICAL";
export type FamilyDocStatus = "PENDING" | "ACCEPTED" | "REJECTED";

// Beninese digital code, article 446: before 16 an online service processes
// a minor's data with the parents' consent. A student sends pieces from 16,
// never health pieces, which stay with the parents (research report, 3.2).
export const STUDENT_UPLOAD_AGE = 16;

// Whole years between the birth date and the day, both read as UTC dates.
export function ageOn(birthDate: Date, day: Date) {
  let age = day.getUTCFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday = day.getUTCMonth() < birthDate.getUTCMonth() || (day.getUTCMonth() === birthDate.getUTCMonth() && day.getUTCDate() < birthDate.getUTCDate());
  if (beforeBirthday) age--;
  return age;
}

// Health data: a medical certificate, or an enrollment piece the school
// marked as a health piece (vaccination record, livret de santé).
export function isHealthDoc(doc: { kind: FamilyDocKind; requiredPiece?: { isHealth: boolean } | null }) {
  return doc.kind === "MEDICAL" || !!doc.requiredPiece?.isHealth;
}

export type Sender = { guardianId: string | null; studentId: string | null };

// Why this account may not send this piece, or null when it may. The
// ownership of the child is checked by the caller's scoped query.
export function refusalToSend(sender: Sender, doc: { health: boolean }, student: { birthDate: Date }, today: Date): string | null {
  if (sender.guardianId) return null;
  if (!sender.studentId) return "Seuls les parents et les élèves envoient des pièces.";
  if (doc.health) return "Les pièces de santé sont envoyées par vos parents.";
  if (ageOn(student.birthDate, today) < STUDENT_UPLOAD_AGE) return `Vous pourrez envoyer vos pièces vous-même à partir de ${STUDENT_UPLOAD_AGE} ans. D'ici là, vos parents s'en occupent.`;
  return null;
}

// The right a member of staff needs to open and decide a piece.
export function reviewPermission(doc: { health: boolean }) {
  return doc.health ? ("health_document:approve" as const) : ("family_document:approve" as const);
}

// Who in the family may open a piece already sent: the parents always, the
// student only for a piece that is not a health piece.
export function familyMayRead(reader: Sender, doc: { health: boolean }) {
  if (reader.guardianId) return true;
  return !!reader.studentId && !doc.health;
}

// Health files are deleted as soon as the school has decided: only the
// decision, the period and the date stay (APDP, sensitive data).
export function dropsFileOnDecision(doc: { health: boolean }) {
  return doc.health;
}

// A piece can be sent for a slot unless one is waiting or already accepted.
export function canSendAgain(existing: { status: FamilyDocStatus }[]) {
  return !existing.some((d) => d.status === "PENDING" || d.status === "ACCEPTED");
}

export const MAX_DISPENSATION_DAYS = 366;

// The period of an EPS dispensation: both days included, the end on or after
// the start, one school year at most.
export function periodError(startsOn: string, endsOn: string): string | null {
  const start = Date.parse(`${startsOn}T00:00:00Z`);
  const end = Date.parse(`${endsOn}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return "Indiquez les deux dates de la dispense.";
  if (end < start) return "La fin de la dispense doit venir après son début.";
  if ((end - start) / 86_400_000 + 1 > MAX_DISPENSATION_DAYS) return "Une dispense couvre une année scolaire au plus.";
  return null;
}

// A dispensation in force on a day: accepted, and the day inside its period.
export function dispensationActive(d: { status: FamilyDocStatus; startsOn: Date | null; endsOn: Date | null }, day: Date) {
  if (d.status !== "ACCEPTED" || !d.startsOn || !d.endsOn) return false;
  const t = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
  return d.startsOn.getTime() <= t && t <= d.endsOn.getTime();
}

export const KIND_LABELS: Record<FamilyDocKind, string> = {
  ENROLLMENT: "Pièce d'inscription",
  ABSENCE: "Justificatif d'absence",
  MEDICAL: "Certificat médical (dispense d'EPS)",
};

export const STATUS_LABELS: Record<FamilyDocStatus, string> = {
  PENDING: "L'école n'a pas encore répondu",
  ACCEPTED: "Validée",
  REJECTED: "Refusée",
};

export const STATUS_TONES = { PENDING: "warning", ACCEPTED: "success", REJECTED: "danger" } as const;

export const isKind = (v: unknown): v is FamilyDocKind => v === "ENROLLMENT" || v === "ABSENCE" || v === "MEDICAL";
export const isStatus = (v: unknown): v is FamilyDocStatus => v === "PENDING" || v === "ACCEPTED" || v === "REJECTED";
