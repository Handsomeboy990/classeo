"use server";

import { z } from "zod";

import { id } from "@/features/classes/academic";
import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { rosterClassroomWhere } from "@/lib/auth/scope";
import { db } from "@/lib/db";
import { COUNCIL_DECISIONS, decisionError } from "@/lib/domain/council";
import { DomainError } from "@/lib/errors";
import { assertWritable } from "@/lib/guards";

import { classCouncil } from "./queries";

const list = <T extends z.ZodType>(item: T) => z.preprocess((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]), z.array(item).max(200));

// The decisions of a class council, recorded by the school head. A pupil
// left without a decision is skipped; a decision already recorded can be
// changed while the year is open.
export const saveCouncilDecisions = createAction({
  permission: "report_card:publish",
  schema: z.object({
    classroomId: id,
    enrollmentId: list(id),
    decision: list(z.enum(["", ...COUNCIL_DECISIONS])),
    note: list(z.string().trim().max(300, "Observation : 300 caractères au maximum.")),
  }),
  handler: async (input, user) => {
    const classroom = await db.classroom.findFirst({ where: { AND: [{ id: input.classroomId }, rosterClassroomWhere(user)] }, select: { id: true, name: true, schoolId: true, academicYearId: true } });
    if (!classroom || user.scope.level !== "SCHOOL") throw new DomainError("Classe introuvable dans votre établissement.");
    await assertWritable({ schoolId: classroom.schoolId, academicYearId: classroom.academicYearId });
    if (input.decision.length !== input.enrollmentId.length || input.note.length !== input.enrollmentId.length) throw new DomainError("Formulaire incomplet, rechargez la page.");
    const sheet = await classCouncil(user, classroom.id);
    const pupils = new Map((sheet?.pupils ?? []).map((p) => [p.enrollmentId, p]));
    let saved = 0;
    for (const [i, enrollmentId] of input.enrollmentId.entries()) {
      const decision = input.decision[i];
      if (!decision) continue;
      const pupil = pupils.get(enrollmentId);
      if (!pupil) throw new DomainError("Un élève ne fait pas partie de cette classe.");
      const note = input.note[i] || null;
      const error = decisionError({ decision, note });
      if (error) throw new DomainError(`${pupil.student.lastName} ${pupil.student.firstName} : ${error}`);
      const data = { decision, note, yearlyAverage: pupil.yearlyAverage, decidedById: user.id, decidedAt: new Date() };
      await db.classCouncilDecision.upsert({ where: { enrollmentId }, create: { enrollmentId, ...data }, update: data });
      saved++;
    }
    await audit(user, { action: "update", resource: "report_card", resourceId: classroom.id, schoolId: classroom.schoolId, summary: `Décisions du conseil de classe de la ${classroom.name} : ${saved} élève${saved > 1 ? "s" : ""}` });
    return saved ? `${saved} décision${saved > 1 ? "s enregistrées" : " enregistrée"}.` : "Aucune décision choisie.";
  },
});
