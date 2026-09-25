"use server";

import { z } from "zod";

import { id, requireActiveYear } from "@/features/classes/academic";
import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { enrollmentWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { assertWritable } from "@/lib/guards";

import { dropPhotoBlob, optionalPhoto, storeStudentPhoto } from "./photo";

type User = NonNullable<CurrentUser>;

// The school that enrolls the pupil this year manages the photo.
async function studentOfMySchool(user: User, studentId: string) {
  const year = await requireActiveYear();
  const enrollment = await db.enrollment.findFirst({
    where: { AND: [{ studentId, academicYearId: year.id }, enrollmentWhere(user)] },
    select: { schoolId: true, academicYearId: true, student: { select: { id: true, firstName: true, lastName: true, photoFileId: true } } },
  });
  if (!enrollment) throw new DomainError("Élève introuvable ou hors de votre périmètre.");
  await assertWritable({ schoolId: enrollment.schoolId, academicYearId: enrollment.academicYearId });
  return enrollment;
}

export const updateStudentPhoto = createAction({
  permission: "student:update",
  schema: z.object({ studentId: id, photo: optionalPhoto }),
  handler: async (input, user) => {
    if (!input.photo) throw new DomainError("Choisissez une photo.");
    const { student, schoolId } = await studentOfMySchool(user, input.studentId);
    const fileId = await storeStudentPhoto(user, input.photo);
    await db.student.update({ where: { id: student.id }, data: { photoFileId: fileId } });
    await dropPhotoBlob(student.photoFileId);
    await audit(user, { action: "update", resource: "student", resourceId: student.id, summary: `Photo de ${student.firstName} ${student.lastName} ${student.photoFileId ? "remplacée" : "ajoutée"}`, schoolId });
    return "Photo enregistrée.";
  },
});

export const removeStudentPhoto = createAction({
  permission: "student:update",
  schema: z.object({ studentId: id }),
  handler: async (input, user) => {
    const { student, schoolId } = await studentOfMySchool(user, input.studentId);
    if (!student.photoFileId) return "Aucune photo à retirer.";
    await db.student.update({ where: { id: student.id }, data: { photoFileId: null } });
    await dropPhotoBlob(student.photoFileId);
    await audit(user, { action: "update", resource: "student", resourceId: student.id, summary: `Photo de ${student.firstName} ${student.lastName} retirée`, schoolId });
    return "Photo retirée.";
  },
});
