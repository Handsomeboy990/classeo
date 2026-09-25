"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { checkbox, id, optionalText, phone, requiredText } from "@/features/classes/academic";
import { studentWhere } from "@/features/students/queries";
import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";

import { guardianWhere } from "./queries";

type User = NonNullable<CurrentUser>;

const fields = {
  lastName: requiredText(60),
  firstName: requiredText(60),
  phone,
  profession: optionalText(80),
  preferredChannel: z.enum(["APP", "SMS", "VOICE_CALL"]),
  prefersAudio: checkbox,
};

const link = {
  studentId: id,
  relationship: requiredText(40),
  isPrimary: checkbox,
};

async function findStudent(user: User, studentId: string) {
  const student = await db.student.findFirst({ where: { AND: [{ id: studentId }, studentWhere(user)] }, select: { id: true, firstName: true, lastName: true } });
  if (!student) throw new DomainError("Élève introuvable ou hors de votre périmètre.");
  return student;
}

async function findGuardian(user: User, guardianId: string) {
  const guardian = await db.guardian.findFirst({ where: { AND: [{ id: guardianId }, guardianWhere(user)] }, select: { id: true, firstName: true, lastName: true } });
  if (!guardian) throw new DomainError("Parent introuvable ou hors de votre périmètre.");
  return guardian;
}

// A primary guardian is the one the school calls first: one per student.
async function linkChild(guardianId: string, input: { studentId: string; relationship: string; isPrimary: boolean }) {
  await db.$transaction([
    ...(input.isPrimary ? [db.studentGuardian.updateMany({ where: { studentId: input.studentId }, data: { isPrimary: false } })] : []),
    db.studentGuardian.upsert({
      where: { studentId_guardianId: { studentId: input.studentId, guardianId } },
      create: { studentId: input.studentId, guardianId, relationship: input.relationship, isPrimary: input.isPrimary },
      update: { relationship: input.relationship, isPrimary: input.isPrimary },
    }),
  ]);
}

// A guardian is always created with a child: without one, nobody in a school
// could see or reach them.
export const createGuardian = createAction({
  permission: "parent:create",
  schema: z.object({ ...fields, ...link }),
  handler: async (input, user) => {
    const student = await findStudent(user, input.studentId);
    const guardian = await db.guardian.create({
      data: { lastName: input.lastName, firstName: input.firstName, phone: input.phone, profession: input.profession, preferredChannel: input.preferredChannel, prefersAudio: input.prefersAudio },
    });
    await linkChild(guardian.id, input);
    await audit(user, {
      action: "create",
      resource: "parent",
      resourceId: guardian.id,
      summary: `Ajout du parent ${input.firstName} ${input.lastName} (${input.relationship} de ${student.firstName} ${student.lastName})`,
    });
    redirect(`/espace/parents/${guardian.id}`);
  },
});

export const updateGuardian = createAction({
  permission: "parent:update",
  schema: z.object({ id, ...fields }),
  handler: async (input, user) => {
    const guardian = await findGuardian(user, input.id);
    const { id: guardianId, ...data } = input;
    await db.guardian.update({ where: { id: guardianId }, data });
    await audit(user, { action: "update", resource: "parent", resourceId: guardian.id, summary: `Modification du parent ${input.firstName} ${input.lastName}` });
    return "Parent enregistré.";
  },
});

export const addChild = createAction({
  permission: "parent:update",
  schema: z.object({ guardianId: id, ...link }),
  handler: async (input, user) => {
    const guardian = await findGuardian(user, input.guardianId);
    const student = await findStudent(user, input.studentId);
    await linkChild(guardian.id, input);
    await audit(user, {
      action: "update",
      resource: "parent",
      resourceId: guardian.id,
      summary: `${guardian.firstName} ${guardian.lastName} rattaché(e) à ${student.firstName} ${student.lastName} (${input.relationship})`,
    });
    return `${student.firstName} ${student.lastName} rattaché(e).`;
  },
});

export const removeChild = createAction({
  permission: "parent:update",
  schema: z.object({ guardianId: id, studentId: id }),
  handler: async (input, user) => {
    const guardian = await findGuardian(user, input.guardianId);
    const student = await findStudent(user, input.studentId);
    const [linksOfGuardian, linksOfStudent] = await Promise.all([
      db.studentGuardian.count({ where: { guardianId: guardian.id, student: studentWhere(user) } }),
      db.studentGuardian.count({ where: { studentId: student.id } }),
    ]);
    if (linksOfStudent <= 1) throw new DomainError("C'est le seul parent de cet élève : ajoutez d'abord un autre parent.");
    if (linksOfGuardian <= 1) throw new DomainError("Ce parent n'a pas d'autre enfant dans l'établissement : il ne serait plus joignable.");
    await db.studentGuardian.delete({ where: { studentId_guardianId: { studentId: student.id, guardianId: guardian.id } } });
    await audit(user, {
      action: "update",
      resource: "parent",
      resourceId: guardian.id,
      summary: `${guardian.firstName} ${guardian.lastName} détaché(e) de ${student.firstName} ${student.lastName}`,
    });
    return "Lien retiré.";
  },
});
