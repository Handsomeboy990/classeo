import "server-only";

import { ForbiddenError } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";

import { isUniqueViolation } from "@/features/classes/academic";

import { BUSY_MS, outcomeOfExisting } from "./rules";
import type { OfflineKind } from "./types";

export const ALREADY_SAVED = "Déjà enregistré.";
const FOREIGN = "Cette saisie ne peut pas être envoyée depuis ce compte.";

// Makes a write idempotent under a client generated identifier (a UUID made
// on the device when the user pressed save). The first request claims the
// identifier, runs the write and records the result; a later request with
// the same identifier (the answer was lost, a second tab, the service
// worker) gets that result back without writing twice.
//
// Without an identifier the write simply runs: online saves of grades and
// attendance are idempotent upserts and need no record.
export async function withSubmission<R>(user: { id: string }, clientId: string | undefined, kind: OfflineKind, run: () => Promise<R>): Promise<R | string> {
  if (!clientId) return run();

  const claimed = await claim(user.id, clientId, kind);
  if (!claimed.ok) {
    const outcome = claimed.outcome;
    if (outcome.outcome === "applied") return ALREADY_SAVED;
    if (claimed.foreign) throw new ForbiddenError(FOREIGN);
    throw new DomainError(outcome.outcome === "rejected" ? outcome.reason : "Envoi déjà en cours.");
  }

  try {
    const result = await run();
    await db.offlineSubmission.update({ where: { clientId }, data: { status: "applied", error: null } });
    return result;
  } catch (error) {
    if (error instanceof DomainError || error instanceof ForbiddenError) {
      await db.offlineSubmission.update({ where: { clientId }, data: { status: "rejected", error: error.message.slice(0, 1000) } });
    } else {
      // Unexpected failure: nothing was decided, the entry may be sent again.
      await db.offlineSubmission.deleteMany({ where: { clientId, status: "processing" } });
    }
    throw error;
  }
}

async function claim(userId: string, clientId: string, kind: OfflineKind) {
  try {
    await db.offlineSubmission.create({ data: { clientId, userId, kind, status: "processing" } });
    return { ok: true as const };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  const row = await db.offlineSubmission.findUnique({ where: { clientId } });
  if (row && row.userId !== userId) return { ok: false as const, foreign: true, outcome: { outcome: "rejected" as const, reason: FOREIGN } };
  const outcome = outcomeOfExisting(row, userId);
  if (outcome) return { ok: false as const, outcome };
  // A claim left behind by a request that died: taken over, once.
  const { count } = await db.offlineSubmission.updateMany({
    where: { clientId, userId, status: "processing", createdAt: { lt: new Date(Date.now() - BUSY_MS) } },
    data: { createdAt: new Date() },
  });
  if (count) return { ok: true as const };
  return { ok: false as const, outcome: { outcome: "retry" as const } };
}

// A refusal decided before the write (conflict, closed year): recorded so a
// later replay of the same entry gets the same answer.
export async function recordRejected(userId: string, clientId: string, kind: OfflineKind, reason: string) {
  try {
    await db.offlineSubmission.create({ data: { clientId, userId, kind, status: "rejected", error: reason.slice(0, 1000) } });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
}

export async function findSubmission(clientId: string) {
  return db.offlineSubmission.findUnique({ where: { clientId }, select: { userId: true, status: true, error: true, createdAt: true } });
}
