// Transfer rules, pure and unit tested. Safe for client and server.
//
// A class change inside a school is immediate. A school change goes through
// two consents: the primary guardian first, then the destination school,
// which chooses the class. The origin school may cancel while it is pending.

export type TransferKindCode = "CLASS_CHANGE" | "SCHOOL_CHANGE";
export type TransferStatusCode = "PENDING_GUARDIAN" | "PENDING_DESTINATION" | "ACCEPTED" | "REJECTED" | "CANCELLED";

export const KIND_LABELS: Record<TransferKindCode, string> = {
  CLASS_CHANGE: "Changement de classe",
  SCHOOL_CHANGE: "Changement d'établissement",
};

export const STATUS_LABELS: Record<TransferStatusCode, string> = {
  PENDING_GUARDIAN: "En attente du parent",
  PENDING_DESTINATION: "En attente de l'établissement d'accueil",
  ACCEPTED: "Accepté",
  REJECTED: "Refusé",
  CANCELLED: "Annulé",
};

export const STATUS_TONES: Record<TransferStatusCode, "warning" | "info" | "success" | "danger" | "neutral"> = {
  PENDING_GUARDIAN: "warning",
  PENDING_DESTINATION: "info",
  ACCEPTED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

export const PENDING_STATUSES: TransferStatusCode[] = ["PENDING_GUARDIAN", "PENDING_DESTINATION"];

export function isPending(status: TransferStatusCode) {
  return PENDING_STATUSES.includes(status);
}

export type TransferEvent = "guardian_approve" | "guardian_refuse" | "destination_accept" | "destination_refuse" | "cancel";

// The status a transfer moves to, or the reason the event is refused. The
// message is shown to the user as is.
export function nextStatus(kind: TransferKindCode, status: TransferStatusCode, event: TransferEvent): { ok: true; status: TransferStatusCode } | { ok: false; message: string } {
  if (kind === "CLASS_CHANGE") return { ok: false, message: "Un changement de classe est immédiat : il n'y a rien à valider." };
  switch (event) {
    case "guardian_approve":
    case "guardian_refuse":
      if (status !== "PENDING_GUARDIAN") return { ok: false, message: "Le parent a déjà donné sa réponse pour ce transfert." };
      return { ok: true, status: event === "guardian_approve" ? "PENDING_DESTINATION" : "REJECTED" };
    case "destination_accept":
    case "destination_refuse":
      if (status === "PENDING_GUARDIAN") return { ok: false, message: "Le parent n'a pas encore donné son accord." };
      if (status !== "PENDING_DESTINATION") return { ok: false, message: "Ce transfert a déjà été traité." };
      return { ok: true, status: event === "destination_accept" ? "ACCEPTED" : "REJECTED" };
    case "cancel":
      if (!isPending(status)) return { ok: false, message: "Seul un transfert en attente peut être annulé." };
      return { ok: true, status: "CANCELLED" };
  }
}

type Person = { name: string; role?: string | null } | null | undefined;

export type TimelineInput = {
  kind: TransferKindCode;
  status: TransferStatusCode;
  createdAt: Date;
  requestedBy: Person;
  fromSchool: string;
  fromClassroom: string | null;
  toSchool: string;
  toClassroom: string | null;
  guardianDecidedAt: Date | null;
  guardianDecisionBy: Person;
  // True when the consent was recorded by school staff (a parent without an
  // account who signed on paper).
  guardianRecordedByStaff: boolean;
  decidedAt: Date | null;
  decidedBy: Person;
  decisionNote: string | null;
};

export type TimelineStep = {
  key: string;
  at: Date | null;
  title: string;
  detail?: string;
  tone: "done" | "current" | "refused" | "upcoming";
};

const who = (p: Person) => (p ? `${p.name}${p.role ? `, ${p.role}` : ""}` : null);

// Each step of a transfer, done or still ahead, for the timeline view.
export function transferTimeline(t: TimelineInput): TimelineStep[] {
  const steps: TimelineStep[] = [];
  if (t.kind === "CLASS_CHANGE") {
    steps.push({
      key: "created",
      at: t.createdAt,
      title: `Changement de classe : ${t.fromClassroom ?? "?"} vers ${t.toClassroom ?? "?"}`,
      detail: who(t.requestedBy) ?? undefined,
      tone: "done",
    });
    return steps;
  }

  steps.push({ key: "created", at: t.createdAt, title: `Demande de ${t.fromSchool}`, detail: who(t.requestedBy) ?? undefined, tone: "done" });

  const guardianRefused = t.status === "REJECTED" && t.guardianDecidedAt !== null && t.decidedAt === null;
  if (t.guardianDecidedAt) {
    steps.push({
      key: "guardian",
      at: t.guardianDecidedAt,
      title: guardianRefused ? "Le parent a refusé" : t.guardianRecordedByStaff ? "Accord du parent recueilli par l'établissement" : "Le parent a donné son accord",
      detail: [who(t.guardianDecisionBy), guardianRefused ? t.decisionNote : null].filter(Boolean).join(" · ") || undefined,
      tone: guardianRefused ? "refused" : "done",
    });
  } else if (t.status === "PENDING_GUARDIAN") {
    steps.push({ key: "guardian", at: null, title: "Accord du parent", detail: "En attente", tone: "current" });
  } else if (t.status === "CANCELLED") {
    // Cancelled before the guardian answered: nothing more to show here.
  }

  if (t.status === "CANCELLED") {
    steps.push({ key: "cancelled", at: t.decidedAt, title: "Transfert annulé par l'établissement d'origine", detail: [who(t.decidedBy), t.decisionNote].filter(Boolean).join(" · ") || undefined, tone: "refused" });
    return steps;
  }
  if (guardianRefused) return steps;

  if (t.decidedAt) {
    const accepted = t.status === "ACCEPTED";
    steps.push({
      key: "destination",
      at: t.decidedAt,
      title: accepted ? `Accepté par ${t.toSchool}${t.toClassroom ? `, en ${t.toClassroom}` : ""}` : `Refusé par ${t.toSchool}`,
      detail: [who(t.decidedBy), t.decisionNote].filter(Boolean).join(" · ") || undefined,
      tone: accepted ? "done" : "refused",
    });
  } else {
    steps.push({
      key: "destination",
      at: null,
      title: `Réponse de ${t.toSchool}`,
      detail: t.status === "PENDING_DESTINATION" ? "En attente" : "Après l'accord du parent",
      tone: t.status === "PENDING_DESTINATION" ? "current" : "upcoming",
    });
  }
  return steps;
}

// The side of a transfer a school stands on, for the outgoing and incoming
// tabs.
export function directionFor(schoolId: string | null, t: { fromSchoolId: string; toSchoolId: string }): "outgoing" | "incoming" | "internal" | null {
  if (!schoolId) return null;
  if (t.fromSchoolId === schoolId && t.toSchoolId === schoolId) return "internal";
  if (t.fromSchoolId === schoolId) return "outgoing";
  if (t.toSchoolId === schoolId) return "incoming";
  return null;
}
