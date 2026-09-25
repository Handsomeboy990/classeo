// Pure decisions of the offline replay, unit tested (rules.test.ts).
//
// A value typed offline may only overwrite what the device had read. When
// the target changed on the server in the meantime (another person, another
// device), the server keeps the newer value and refuses the entry, unless
// both sides already agree. Last write wins only where it is safe: when
// nothing else was written since the device read the page.

import type { AttendanceBaseline, AttendanceRecordInput, GradeCell, ReplayOutcome } from "./types";

const gradeKey = (c: { enrollmentId: string; type: string; sequence: number }) => `${c.enrollmentId}|${c.type}|${c.sequence}`;

const sameGrade = (a: number | null, b: number | null) => (a === null || b === null ? a === b : Math.round(a * 100) === Math.round(b * 100));

export type CurrentGrade = { enrollmentId: string; type: string; sequence: number; value: number };

// Cells whose server value differs both from what the device read and from
// what the user typed. A cell without a known baseline is a conflict as soon
// as the server holds a different value.
export function gradeConflicts(current: CurrentGrade[], baseline: GradeCell[] | null | undefined, next: GradeCell[]): GradeCell[] {
  const now = new Map(current.map((g) => [gradeKey(g), g.value]));
  const before = new Map((baseline ?? []).map((c) => [gradeKey(c), c.value]));
  return next.filter((cell) => {
    const key = gradeKey(cell);
    const server = now.get(key) ?? null;
    if (sameGrade(server, cell.value)) return false;
    if (!before.has(key)) return server !== null;
    return !sameGrade(server, before.get(key) ?? null);
  });
}

export type CurrentAttendance = { enrollmentId: string; status: AttendanceRecordInput["status"]; reason: string | null };

type Mark = { status: AttendanceRecordInput["status"] | null; reason: string | null | undefined };

// A present student carries no reason; an empty reason is no reason.
function sameMark(a: Mark, b: Mark) {
  if (a.status !== b.status) return false;
  if (a.status === "PRESENT" || a.status === null) return true;
  return (a.reason ?? "").trim() === (b.reason ?? "").trim();
}

// Students whose record changed on the server since the device read the
// register, to something other than what the user marked.
export function attendanceConflicts(current: CurrentAttendance[], baseline: AttendanceBaseline["records"] | null | undefined, next: AttendanceRecordInput[]): AttendanceRecordInput[] {
  const now = new Map(current.map((r) => [r.enrollmentId, r]));
  const before = new Map((baseline ?? []).map((r) => [r.enrollmentId, r]));
  return next.filter((record) => {
    const server = now.get(record.enrollmentId);
    const serverMark: Mark = server ? { status: server.status, reason: server.reason } : { status: null, reason: null };
    if (sameMark(serverMark, record)) return false;
    const read = before.get(record.enrollmentId);
    if (!read) return serverMark.status !== null;
    return !sameMark(serverMark, read);
  });
}

// Earlier record of the same entry: a replay after a lost answer, or a
// second tab sending the same queue.
export type SubmissionRow = { userId: string; status: string; error: string | null; createdAt: Date };

export const BUSY_MS = 2 * 60 * 1000;

export function outcomeOfExisting(row: SubmissionRow | null, userId: string, now = new Date()): ReplayOutcome | null {
  if (!row) return null;
  // An identifier is random and bound to one account: never reveal what
  // another account sent with it.
  if (row.userId !== userId) return { outcome: "rejected", reason: "Cette saisie ne peut pas être envoyée depuis ce compte." };
  if (row.status === "applied") return { outcome: "applied", duplicate: true, message: "Déjà enregistré." };
  if (row.status === "rejected") return { outcome: "rejected", reason: row.error ?? "Saisie refusée." };
  // "processing": another request is writing it right now.
  if (now.getTime() - row.createdAt.getTime() < BUSY_MS) return { outcome: "retry", reason: "Envoi déjà en cours." };
  return null;
}

// "Aïcha Dossou (Interrogation 1), Koffi Mensah (Devoir) et 2 autres".
export function listNames(names: string[], max = 3) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  if (rest > 0) return `${shown.join(", ")} et ${rest} autre${rest > 1 ? "s" : ""}`;
  if (shown.length < 2) return shown.join("");
  return `${shown.slice(0, -1).join(", ")} et ${shown[shown.length - 1]}`;
}

const EVALUATION = { INTERROGATION: "Interrogation", DEVOIR: "Devoir", COMPOSITION: "Composition" } as const;

export function gradeConflictReason(conflicts: GradeCell[], names: Map<string, string>) {
  const items = conflicts.map((c) => `${names.get(c.enrollmentId) ?? "un élève"} (${EVALUATION[c.type]} ${c.sequence})`);
  const n = conflicts.length;
  return `${n > 1 ? `${n} notes ont été modifiées` : "Une note a été modifiée"} par une autre saisie depuis que cette page a été ouverte : ${listNames(items)}. Rien n'a été enregistré. Rouvrez la fiche, comparez avec les valeurs actuelles, puis renvoyez.`;
}

export function attendanceConflictReason(conflicts: AttendanceRecordInput[], names: Map<string, string>) {
  const items = conflicts.map((c) => names.get(c.enrollmentId) ?? "un élève");
  const n = conflicts.length;
  return `L'appel a été modifié par une autre personne depuis que cette page a été ouverte (${n > 1 ? `${n} élèves` : "un élève"} : ${listNames(items)}). Rien n'a été enregistré. Rouvrez l'appel, vérifiez, puis renvoyez.`;
}
