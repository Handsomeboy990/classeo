"use server";

import { z } from "zod";

import { checkbox, id } from "@/features/classes/academic";
import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { isIsoDate, isoToDate, todayIso } from "@/lib/domain/attendance";
import { DomainError } from "@/lib/errors";
import { assertWritable } from "@/lib/guards";
import { notify } from "@/lib/notify";

import { currentHolder } from "./queries";

// The school holding the pupil this year opens the record to another
// school (a pupil enrolling there without a transfer), with the guardian's
// consent, for a limited time or without end, and can close it again.

async function holderOrFail(user: Parameters<typeof currentHolder>[0], studentId: string) {
  const schoolId = await currentHolder(user, studentId);
  if (!schoolId) throw new DomainError("Seul l'établissement qui accueille l'élève cette année peut partager son dossier.");
  await assertWritable({ schoolId });
  return schoolId;
}

export const grantRecordAccess = createAction({
  permission: "student:update",
  schema: z.object({
    studentId: id,
    schoolId: z.string({ error: "Choisissez l'établissement." }).trim().min(1, "Choisissez l'établissement.").max(64),
    expiresOn: z
      .string()
      .trim()
      .optional()
      .transform((v) => v || null)
      .refine((v) => v === null || (isIsoDate(v) && v > todayIso()), "Choisissez une date à venir, ou laissez vide."),
    guardianConsent: checkbox.refine((v) => v, "L'accord du parent est obligatoire pour partager le dossier."),
  }),
  handler: async (input, user) => {
    const holderId = await holderOrFail(user, input.studentId);
    if (input.schoolId === holderId) throw new DomainError("Votre établissement lit déjà ce dossier.");
    const [target, student] = await Promise.all([
      db.school.findFirst({ where: { id: input.schoolId, status: "ACTIVE" }, select: { id: true, name: true } }),
      db.student.findUniqueOrThrow({ where: { id: input.studentId }, select: { id: true, firstName: true, lastName: true } }),
    ]);
    if (!target) throw new DomainError("Établissement introuvable ou fermé.");
    const expiresAt = input.expiresOn ? isoToDate(input.expiresOn) : null;
    await db.studentRecordAccess.upsert({
      where: { studentId_schoolId: { studentId: student.id, schoolId: target.id } },
      create: { studentId: student.id, schoolId: target.id, grantedById: user.id, expiresAt },
      update: { grantedById: user.id, expiresAt },
    });
    const name = `${student.firstName} ${student.lastName}`;
    await audit(user, {
      action: "approve",
      resource: "record_access",
      resourceId: student.id,
      summary: `Dossier scolaire de ${name} partagé avec ${target.name}${input.expiresOn ? ` jusqu'au ${input.expiresOn}` : ""}, avec l'accord du parent`,
      metadata: { schoolId: target.id, expiresOn: input.expiresOn },
      schoolId: holderId,
    });
    const staff = await db.user.findMany({
      where: { schoolId: target.id, isActive: true, scopeLevel: "SCHOOL", role: { permissions: { some: { permission: { code: "student:create" } } } } },
      select: { id: true },
    });
    await notify(
      staff.map((u) => u.id),
      { kind: "record_access", title: `Dossier scolaire de ${name} partagé`, body: `Vous pouvez lire le parcours de ${name}${input.expiresOn ? ` jusqu'au ${input.expiresOn}` : ""}.`, link: `/espace/eleves/${student.id}/parcours` },
    );
    return `Dossier partagé avec ${target.name}.`;
  },
});

export const revokeRecordAccess = createAction({
  permission: "student:update",
  schema: z.object({ studentId: id, accessId: id }),
  handler: async (input, user) => {
    const holderId = await holderOrFail(user, input.studentId);
    const access = await db.studentRecordAccess.findFirst({ where: { id: input.accessId, studentId: input.studentId }, select: { id: true, school: { select: { name: true } } } });
    if (!access) throw new DomainError("Partage introuvable.");
    await db.studentRecordAccess.delete({ where: { id: access.id } });
    await audit(user, { action: "delete", resource: "record_access", resourceId: input.studentId, summary: `Fin du partage du dossier scolaire avec ${access.school.name}`, schoolId: holderId });
    return `${access.school.name} ne lit plus ce dossier.`;
  },
});
