"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { checkbox, id, isUniqueViolation, optionalPhone, optionalText, requiredText } from "@/features/classes/academic";
import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { schoolWhere } from "@/lib/auth/scope";
import { invalidate, tags } from "@/lib/cache";
import { isIsoDate, isoToDate, todayIso } from "@/lib/domain/attendance";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";

import { teacherWhere } from "./queries";

const hiredAt = z
  .string()
  .optional()
  .transform((v) => v || null)
  .refine((v) => v === null || (isIsoDate(v) && v <= todayIso()), "Date invalide ou à venir.");

const fields = {
  lastName: requiredText(60),
  firstName: requiredText(60),
  gender: z
    .enum(["F", "M", ""])
    .optional()
    .transform((v) => (v ? v : null)),
  phone: optionalPhone,
  specialty: optionalText(80),
  hiredAt,
};

// "ENS-" + five digits, as the seeded teacher matricules.
async function nextMatricule() {
  const last = await db.teacher.findFirst({ where: { matricule: { startsWith: "ENS-" } }, orderBy: { matricule: "desc" }, select: { matricule: true } });
  const seq = last ? Number.parseInt(last.matricule.slice(4), 10) || 0 : 0;
  return `ENS-${String(seq + 1).padStart(5, "0")}`;
}

export const createTeacher = createAction({
  permission: "teacher:create",
  schema: z.object(fields),
  handler: async (input, user) => {
    const schoolId = user.scope.schoolId;
    if (!schoolId) throw new DomainError("L'ajout d'un enseignant se fait depuis un compte d'établissement.");
    const school = await db.school.findFirst({ where: { AND: [{ id: schoolId }, schoolWhere(user)] }, select: { id: true } });
    if (!school) throw new DomainError("Établissement hors de votre périmètre.");
    let teacherId = "";
    for (let attempt = 0; attempt < 3 && !teacherId; attempt++) {
      try {
        const teacher = await db.teacher.create({
          data: { ...input, hiredAt: input.hiredAt ? isoToDate(input.hiredAt) : null, schoolId: school.id, matricule: await nextMatricule() },
        });
        teacherId = teacher.id;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }
    if (!teacherId) throw new DomainError("Le matricule n'a pas pu être attribué. Réessayez.");
    await audit(user, { action: "create", resource: "teacher", resourceId: teacherId, summary: `Ajout de l'enseignant ${input.firstName} ${input.lastName}`, schoolId: school.id });
    invalidate(tags.stats);
    redirect(`/espace/enseignants/${teacherId}`);
  },
});

export const updateTeacher = createAction({
  permission: "teacher:update",
  schema: z.object({ id, ...fields, isActive: checkbox }),
  handler: async (input, user) => {
    const teacher = await db.teacher.findFirst({ where: { AND: [{ id: input.id }, teacherWhere(user)] }, select: { id: true, schoolId: true, isActive: true } });
    if (!teacher) throw new DomainError("Enseignant introuvable ou hors de votre périmètre.");
    const { id: teacherId, hiredAt: hired, ...data } = input;
    await db.teacher.update({ where: { id: teacherId }, data: { ...data, hiredAt: hired ? isoToDate(hired) : null } });
    await audit(user, {
      action: "update",
      resource: "teacher",
      resourceId: teacher.id,
      summary: `Modification de l'enseignant ${input.firstName} ${input.lastName}${teacher.isActive !== input.isActive ? (input.isActive ? ", réactivé" : ", désactivé") : ""}`,
      schoolId: teacher.schoolId,
    });
    if (teacher.isActive !== input.isActive) invalidate(tags.stats);
    return "Enseignant enregistré.";
  },
});
