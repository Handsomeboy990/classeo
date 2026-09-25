// Decision flow of POST /api/offline/replay, written against injected
// dependencies so every branch is unit tested (replay.test.ts). The route
// (src/app/api/offline/replay/route.ts) wires the real session, database
// and server actions.
//
// Order: the session user must be the account that typed the entry; an
// entry already decided gets the same answer; the permission of the online
// action is required; the target must still be writable (school open, year
// open) and unchanged since the device read it; then the very same server
// action runs, with its own validation, scope checks and audit.

import { z } from "zod";

import { attendanceConflictReason, attendanceConflicts, gradeConflictReason, gradeConflicts, outcomeOfExisting, type CurrentAttendance, type CurrentGrade, type SubmissionRow } from "./rules";
import type { AttendanceBaseline, AttendancePayload, GradeCell, GradesPayload, OfflineKind, ReplayOutcome, ReplayRequest } from "./types";

export const PERMISSION_OF = { grades: "grade:update", attendance: "attendance:create", message: "message:create" } as const;

const cell = z.object({
  enrollmentId: z.string().max(64),
  type: z.enum(["INTERROGATION", "DEVOIR", "COMPOSITION"]),
  sequence: z.number().int().min(1).max(6),
  value: z.number().nullable(),
});

export const replayRequestSchema = z.object({
  clientId: z.uuid(),
  userId: z.string().min(1).max(64),
  kind: z.enum(["grades", "attendance", "message"]),
  payload: z.record(z.string(), z.unknown()),
  baseline: z.unknown().optional(),
  createdAt: z.number().int().nonnegative(),
});

// Only what the conflict checks read; the action validates the full payload.
const gradesTarget = z.object({ sheetId: z.string().max(64), cells: z.array(cell).max(3000) });
const gradesBaseline = z.object({ cells: z.array(cell).max(3000) }).nullish();
const attendanceTarget = z.object({
  classroomId: z.string().max(64),
  date: z.string().max(10),
  half: z.enum(["MORNING", "AFTERNOON"]),
  records: z.array(z.object({ enrollmentId: z.string().max(64), status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]), reason: z.string().max(200).optional().default("") })).max(200),
});
const attendanceBaseline = z
  .object({ records: z.array(z.object({ enrollmentId: z.string().max(64), status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]).nullable(), reason: z.string().max(200).default("") })).max(200) })
  .nullish();

type ActionResult = { ok: boolean; message?: string; fieldErrors?: Record<string, string[] | undefined> } | null;

export type ReplayUser = { id: string; mustChangePassword: boolean; permissions: { has(code: string): boolean } };

// The target as the server holds it now, or null when it is not in the
// user's scope (the action then refuses it with its own message).
export type GradeTarget = { schoolId: string; academicYearId: string; grades: CurrentGrade[]; names: Map<string, string> };
export type AttendanceTarget = { schoolId: string; academicYearId: string; records: CurrentAttendance[]; names: Map<string, string> };

export type ReplayDeps = {
  findSubmission: (clientId: string) => Promise<SubmissionRow | null>;
  recordRejected: (userId: string, clientId: string, kind: OfflineKind, reason: string) => Promise<void>;
  // Throws a message safe to show when the school or the year is closed.
  assertWritable: (target: { schoolId: string; academicYearId: string }) => Promise<void>;
  loadGradeTarget: (payload: GradesPayload) => Promise<GradeTarget | null>;
  loadAttendanceTarget: (payload: AttendancePayload) => Promise<AttendanceTarget | null>;
  // The online server action, called with the payload and the identifier.
  runAction: (kind: OfflineKind, input: Record<string, unknown>) => Promise<ActionResult>;
  now?: () => Date;
};

export const NO_PERMISSION = "Vous n'avez plus le droit d'effectuer cette saisie avec ce compte.";

export async function replay(request: ReplayRequest, user: ReplayUser | null, deps: ReplayDeps): Promise<ReplayOutcome> {
  if (!user) return { outcome: "auth" };
  if (user.mustChangePassword) return { outcome: "auth" };
  if (request.userId !== user.id) return { outcome: "other-user" };

  const existing = outcomeOfExisting(await deps.findSubmission(request.clientId), user.id, deps.now?.());
  if (existing) return existing;

  const reject = async (reason: string): Promise<ReplayOutcome> => {
    await deps.recordRejected(user.id, request.clientId, request.kind, reason);
    return { outcome: "rejected", reason };
  };

  if (!user.permissions.has(PERMISSION_OF[request.kind])) return reject(NO_PERMISSION);

  const refusal = await checkTarget(request, deps);
  if (refusal) return reject(refusal);

  const result = await deps.runAction(request.kind, { ...request.payload, clientId: request.clientId });
  if (result?.ok) return { outcome: "applied", message: result.message };

  // The action records its own refusals (withSubmission); a validation
  // failure happens before it and is recorded here. Anything else is a
  // temporary failure: the entry stays queued.
  const after = await deps.findSubmission(request.clientId);
  if (after?.status === "rejected") return { outcome: "rejected", reason: after.error ?? result?.message ?? "Saisie refusée." };
  if (after?.status === "processing") return { outcome: "retry", reason: "Envoi déjà en cours." };
  if (result?.fieldErrors) return reject(validationReason(result));
  return { outcome: "retry", reason: result?.message };
}

function validationReason(result: NonNullable<ActionResult>) {
  const first = Object.values(result.fieldErrors ?? {}).flat().find(Boolean);
  return first ? `${result.message ?? "Certains champs sont invalides."} ${first}` : (result.message ?? "Certains champs sont invalides.");
}

async function checkTarget(request: ReplayRequest, deps: ReplayDeps): Promise<string | null> {
  try {
    if (request.kind === "grades") {
      const payload = gradesTarget.safeParse(request.payload);
      if (!payload.success) return null;
      const target = await deps.loadGradeTarget(payload.data);
      if (!target) return null;
      await deps.assertWritable(target);
      const baseline = gradesBaseline.safeParse(request.baseline);
      const conflicts = gradeConflicts(target.grades, baseline.success ? (baseline.data?.cells as GradeCell[] | undefined) : undefined, payload.data.cells);
      return conflicts.length ? gradeConflictReason(conflicts, target.names) : null;
    }
    if (request.kind === "attendance") {
      const payload = attendanceTarget.safeParse(request.payload);
      if (!payload.success) return null;
      const target = await deps.loadAttendanceTarget(payload.data);
      if (!target) return null;
      await deps.assertWritable(target);
      const baseline = attendanceBaseline.safeParse(request.baseline);
      const conflicts = attendanceConflicts(target.records, baseline.success ? (baseline.data?.records as AttendanceBaseline["records"] | undefined) : undefined, payload.data.records);
      return conflicts.length ? attendanceConflictReason(conflicts, target.names) : null;
    }
    return null;
  } catch (error) {
    if (error instanceof Error && (error.name === "DomainError" || error.name === "ForbiddenError")) return error.message;
    throw error;
  }
}
