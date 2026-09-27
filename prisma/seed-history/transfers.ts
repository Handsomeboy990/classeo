// Pupils who changed school between two years, inside their commune: the
// transfer file, asked in July by the school they left, agreed by the
// family (on paper, recorded by the school), accepted by the new school in
// August, with the history shared.
import type { Prisma } from "../../src/generated/prisma/client";
import type { HistoryContext } from "./index";
import type { Stint } from "./types";
import { shortId } from "../seed-lib/random";

export type BetweenYears = { from: Stint; to: Stint };

const REASONS = [
  "La famille déménage dans un autre quartier de la commune.",
  "Rapprochement du domicile : l'élève faisait une heure de trajet.",
  "Le parent a été muté ; la famille s'installe près du nouveau poste.",
  "L'élève rejoint ses frères et sœurs dans le nouvel établissement.",
  "Demande de la famille, pour un établissement plus proche.",
];

export async function writeTransfers(ctx: HistoryContext, moves: BetweenYears[]) {
  const { rng, years, schoolById } = ctx;
  const transfers: Prisma.StudentTransferCreateManyInput[] = [];
  const access = new Map<string, Prisma.StudentRecordAccessCreateManyInput>();
  for (const { from, to } of moves) {
    const endYear = years[from.year]!.startYear + 1;
    const created = new Date(Date.UTC(endYear, 6, rng.int(2, 24), 9, rng.int(0, 59)));
    const agreed = new Date(created.getTime() + rng.int(1, 5) * 86_400_000);
    const decided = new Date(Date.UTC(endYear, 7, rng.int(3, 28), 10, rng.int(0, 59)));
    const origin = schoolById.get(from.schoolId)!;
    const destination = schoolById.get(to.schoolId)!;
    const requestedById = ctx.directorOf(origin.id) ?? ctx.chainDirector(origin);
    const decidedById = ctx.directorOf(destination.id) ?? ctx.chainDirector(destination);
    transfers.push({
      id: shortId(),
      studentId: from.studentId,
      kind: "SCHOOL_CHANGE",
      fromSchoolId: origin.id,
      fromClassroomId: from.classroomId,
      toSchoolId: destination.id,
      toClassroomId: to.classroomId,
      reason: rng.pick(REASONS),
      shareHistory: true,
      status: "ACCEPTED",
      requestedById,
      guardianDecisionById: requestedById,
      guardianDecidedAt: agreed,
      decidedById,
      decidedAt: decided,
      createdAt: created,
    });
    const key = `${from.studentId}|${destination.id}`;
    if (!access.has(key)) access.set(key, { id: shortId(), studentId: from.studentId, schoolId: destination.id, grantedById: decidedById, createdAt: decided });
  }
  await ctx.input.bulk.insert("StudentTransfer", transfers);
  await ctx.input.bulk.insert("StudentRecordAccess", [...access.values()]);
  console.log(`history: ${transfers.length} transfers between schools`);
}
