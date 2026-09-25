"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { checkbox, id, isUniqueViolation, optionalId, optionalPhone, optionalText, requireActiveYear, requiredText } from "@/features/classes/academic";
import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { classroomWhere, enrollmentWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { invalidate, tags } from "@/lib/cache";
import { isIsoDate, isoToDate, todayIso } from "@/lib/domain/attendance";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";

import { DISABILITIES, ENROLLMENT_STATUS_LABELS } from "./labels";
import { dropPhotoBlob, optionalPhoto, storeStudentPhoto } from "./photo";
import { studentWhere } from "./queries";

type User = NonNullable<CurrentUser>;

const birthDate = z
  .string({ error: "Champ obligatoire." })
  .refine(isIsoDate, "Date invalide.")
  .refine((v) => {
    const age = (isoToDate(todayIso()).getTime() - isoToDate(v).getTime()) / (365.25 * 86400000);
    return age >= 2 && age <= 30;
  }, "L'âge doit être compris entre 2 et 30 ans.");

const studentFields = {
  lastName: requiredText(60),
  firstName: requiredText(60),
  gender: z.enum(["F", "M"], { error: "Choisissez le sexe." }),
  birthDate,
  birthPlace: optionalText(80),
  disabilities: z
    .union([z.array(z.enum(DISABILITIES)), z.enum(DISABILITIES)])
    .optional()
    .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v])),
  classroomId: id,
  isRepeating: checkbox,
  photo: optionalPhoto,
};

async function findClassroomForEnrollment(user: User, classroomId: string, yearId: string) {
  const classroom = await db.classroom.findFirst({
    where: { AND: [{ id: classroomId }, classroomWhere(user), { academicYearId: yearId }] },
    select: { id: true, name: true, schoolId: true, capacity: true, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
  });
  if (!classroom) throw new DomainError("Classe introuvable ou hors de votre périmètre.");
  return classroom;
}

function assertCapacity(classroom: { name: string; capacity: number; _count: { enrollments: number } }) {
  // Rule from StudentService::createStudent.
  if (classroom._count.enrollments >= classroom.capacity) throw new DomainError(`La ${classroom.name} a atteint sa capacité maximale (${classroom.capacity} places).`);
}

// "BJ" + two digit year + six digit sequence, as the seeded matricules.
async function nextMatricule(yearLabel: string) {
  const prefix = `BJ${yearLabel.slice(2, 4)}`;
  // Only numeric suffixes count, so one hand made matricule cannot restart
  // the sequence on numbers already taken.
  const taken = await db.student.findMany({ where: { matricule: { startsWith: prefix } }, select: { matricule: true } });
  const seq = taken.reduce((max, t) => {
    const rest = t.matricule.slice(prefix.length);
    return /^\d+$/.test(rest) ? Math.max(max, Number.parseInt(rest, 10)) : max;
  }, 0);
  return `${prefix}${String(seq + 1).padStart(6, "0")}`;
}

const createSchema = z
  .object({
    ...studentFields,
    guardianMode: z.enum(["existing", "new"], { error: "Choisissez un parent." }),
    guardianId: optionalId,
    guardianLastName: optionalText(60),
    guardianFirstName: optionalText(60),
    guardianPhone: optionalPhone,
    guardianProfession: optionalText(80),
    guardianChannel: z.enum(["APP", "SMS", "VOICE_CALL"]).optional().default("APP"),
    relationship: requiredText(40),
  })
  .superRefine((v, ctx) => {
    if (v.guardianMode === "existing" && !v.guardianId) ctx.addIssue({ code: "custom", path: ["guardianId"], message: "Choisissez le parent." });
    if (v.guardianMode === "new") {
      if (!v.guardianLastName) ctx.addIssue({ code: "custom", path: ["guardianLastName"], message: "Champ obligatoire." });
      if (!v.guardianFirstName) ctx.addIssue({ code: "custom", path: ["guardianFirstName"], message: "Champ obligatoire." });
      if (!v.guardianPhone) ctx.addIssue({ code: "custom", path: ["guardianPhone"], message: "Le téléphone du parent est obligatoire." });
    }
  });

export const createStudent = createAction({
  permission: "student:create",
  schema: createSchema,
  handler: async (input, user) => {
    const year = await requireActiveYear();
    const classroom = await findClassroomForEnrollment(user, input.classroomId, year.id);
    assertCapacity(classroom);
    if (input.guardianMode === "existing") {
      const known = await db.guardian.count({ where: { id: input.guardianId!, students: { some: { student: studentWhere(user) } } } });
      if (!known) throw new DomainError("Parent introuvable ou hors de votre périmètre.");
    }

    const photoFileId = await storeStudentPhoto(user, input.photo);
    let studentId = "";
    for (let attempt = 0; attempt < 3 && !studentId; attempt++) {
      const matricule = await nextMatricule(year.label);
      try {
        studentId = await db.$transaction(async (tx) => {
          const student = await tx.student.create({
            data: {
              matricule,
              lastName: input.lastName,
              firstName: input.firstName,
              gender: input.gender,
              birthDate: isoToDate(input.birthDate),
              birthPlace: input.birthPlace,
              disabilities: input.disabilities,
              photoFileId,
            },
          });
          await tx.enrollment.create({
            data: { studentId: student.id, schoolId: classroom.schoolId, classroomId: classroom.id, academicYearId: year.id, isRepeating: input.isRepeating },
          });
          const guardianId =
            input.guardianMode === "existing"
              ? input.guardianId!
              : (
                  await tx.guardian.create({
                    data: {
                      lastName: input.guardianLastName!,
                      firstName: input.guardianFirstName!,
                      phone: input.guardianPhone!,
                      profession: input.guardianProfession,
                      preferredChannel: input.guardianChannel,
                    },
                  })
                ).id;
          await tx.studentGuardian.create({ data: { studentId: student.id, guardianId, relationship: input.relationship, isPrimary: true } });
          return student.id;
        });
      } catch (error) {
        // Two enrollments at the same instant can compute the same matricule.
        if (!isUniqueViolation(error)) throw error;
      }
    }
    if (!studentId) throw new DomainError("Le matricule n'a pas pu être attribué. Réessayez.");

    await audit(user, {
      action: "create",
      resource: "student",
      resourceId: studentId,
      summary: `Inscription de ${input.firstName} ${input.lastName} en ${classroom.name}`,
      schoolId: classroom.schoolId,
    });
    invalidate(tags.stats);
    redirect(`/espace/eleves/${studentId}?inscrit=1`);
  },
});

export const updateStudent = createAction({
  permission: "student:update",
  schema: z.object({ id, ...studentFields }),
  handler: async (input, user) => {
    const year = await requireActiveYear();
    const student = await db.student.findFirst({
      where: { AND: [{ id: input.id }, studentWhere(user)] },
      include: { enrollments: { where: { AND: [enrollmentWhere(user), { academicYearId: year.id }] }, select: { id: true, classroomId: true, status: true } } },
    });
    if (!student) throw new DomainError("Élève introuvable ou hors de votre périmètre.");
    const enrollment = student.enrollments[0];
    if (!enrollment) throw new DomainError("Cet élève n'est pas inscrit cette année dans votre périmètre.");

    let classChange: { name: string } | null = null;
    if (enrollment.classroomId !== input.classroomId) {
      const classroom = await findClassroomForEnrollment(user, input.classroomId, year.id);
      if (enrollment.status === "ACTIVE") assertCapacity(classroom);
      const grades = await db.grade.count({ where: { enrollmentId: enrollment.id } });
      if (grades) throw new DomainError("Des notes ont déjà été saisies pour cet élève cette année : le changement de classe doit passer par un transfert.");
      classChange = classroom;
    }

    const photoFileId = await storeStudentPhoto(user, input.photo);
    await db.$transaction([
      db.student.update({
        where: { id: student.id },
        data: {
          lastName: input.lastName,
          firstName: input.firstName,
          gender: input.gender,
          birthDate: isoToDate(input.birthDate),
          birthPlace: input.birthPlace,
          disabilities: input.disabilities,
          ...(photoFileId ? { photoFileId } : {}),
        },
      }),
      db.enrollment.update({ where: { id: enrollment.id }, data: { classroomId: input.classroomId, isRepeating: input.isRepeating } }),
    ]);
    if (photoFileId) await dropPhotoBlob(student.photoFileId);
    await audit(user, {
      action: "update",
      resource: "student",
      resourceId: student.id,
      summary: `Modification de l'élève ${input.firstName} ${input.lastName}${classChange ? `, nouvelle classe ${classChange.name}` : ""}`,
    });
    if (classChange) invalidate(tags.stats);
    redirect(`/espace/eleves/${student.id}`);
  },
});

export const setEnrollmentStatus = createAction({
  permission: "student:update",
  schema: z.object({ enrollmentId: id, status: z.enum(["ACTIVE", "TRANSFERRED", "WITHDRAWN"]) }),
  handler: async (input, user) => {
    const enrollment = await db.enrollment.findFirst({
      where: { AND: [{ id: input.enrollmentId }, enrollmentWhere(user)] },
      include: {
        student: { select: { firstName: true, lastName: true } },
        academicYear: { select: { isActive: true } },
        classroom: { select: { name: true, capacity: true, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } } },
      },
    });
    if (!enrollment) throw new DomainError("Inscription introuvable ou hors de votre périmètre.");
    if (!enrollment.academicYear.isActive) throw new DomainError("Seules les inscriptions de l'année active peuvent changer de statut.");
    if (enrollment.status === input.status) return "Aucun changement.";
    if (input.status === "ACTIVE") assertCapacity(enrollment.classroom);
    await db.enrollment.update({ where: { id: enrollment.id }, data: { status: input.status } });
    const name = `${enrollment.student.firstName} ${enrollment.student.lastName}`;
    await audit(user, {
      action: "update",
      resource: "student",
      resourceId: enrollment.studentId,
      summary: `${name} : ${ENROLLMENT_STATUS_LABELS[enrollment.status]} vers ${ENROLLMENT_STATUS_LABELS[input.status]}`,
      schoolId: enrollment.schoolId,
    });
    invalidate(tags.stats);
    return input.status === "ACTIVE" ? `${name} est de nouveau inscrit(e) en ${enrollment.classroom.name}.` : `${name} : statut « ${ENROLLMENT_STATUS_LABELS[input.status]} » enregistré.`;
  },
});
