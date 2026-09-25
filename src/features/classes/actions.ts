"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { classroomWhere, schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { invalidate, tags } from "@/lib/cache";
import { db } from "@/lib/db";
import { assertClassroomWritable, assertWritable } from "@/lib/guards";
import { DomainError } from "@/lib/errors";

import { id, intIn, isUniqueViolation, optionalId, requireActiveYear, requiredText } from "./academic";

type User = NonNullable<CurrentUser>;

const classFields = {
  name: requiredText(40),
  levelId: id,
  capacity: intIn(1, 200, "La capacité"),
  mainTeacherId: optionalId,
};

async function findScopedClassroom(user: User, classroomId: string) {
  const classroom = await db.classroom.findFirst({
    where: { AND: [{ id: classroomId }, classroomWhere(user)] },
    select: { id: true, name: true, schoolId: true, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
  });
  if (!classroom) throw new DomainError("Classe introuvable ou hors de votre périmètre.");
  // Every write on a class goes through here.
  await assertClassroomWritable(classroom.id);
  return classroom;
}

async function assertTeacherOfSchool(teacherId: string | null, schoolId: string) {
  if (!teacherId) return;
  const found = await db.teacher.count({ where: { id: teacherId, schoolId, isActive: true } });
  if (!found) throw new DomainError("Cet enseignant n'appartient pas à l'établissement.");
}

export const createClassroom = createAction({
  permission: "class:create",
  schema: z.object(classFields),
  handler: async (input, user) => {
    const schoolId = user.scope.schoolId;
    if (!schoolId) throw new DomainError("La création d'une classe se fait depuis un compte d'établissement.");
    const school = await db.school.findFirst({ where: { AND: [{ id: schoolId }, schoolWhere(user)] }, select: { id: true, cycle: true } });
    if (!school) throw new DomainError("Établissement hors de votre périmètre.");
    const level = await db.academicLevel.findFirst({ where: { id: input.levelId, cycle: school.cycle } });
    if (!level) throw new DomainError("Ce niveau ne correspond pas au cycle de l'établissement.");
    await assertTeacherOfSchool(input.mainTeacherId, school.id);
    const year = await requireActiveYear();
    await assertWritable({ schoolId: school.id, academicYearId: year.id });

    try {
      const classroom = await db.classroom.create({
        data: { schoolId: school.id, academicYearId: year.id, levelId: level.id, name: input.name, capacity: input.capacity, mainTeacherId: input.mainTeacherId },
      });
      await audit(user, { action: "create", resource: "class", resourceId: classroom.id, summary: `Création de la classe ${classroom.name}`, schoolId: school.id });
      invalidate(tags.stats);
      return { message: `Classe ${classroom.name} créée.`, data: { id: classroom.id } };
    } catch (error) {
      if (isUniqueViolation(error)) throw new DomainError(`Une classe « ${input.name} » existe déjà cette année.`);
      throw error;
    }
  },
});

export const updateClassroom = createAction({
  permission: "class:update",
  schema: z.object({ id, ...classFields }),
  handler: async (input, user) => {
    const classroom = await findScopedClassroom(user, input.id);
    if (input.capacity < classroom._count.enrollments)
      throw new DomainError(`La capacité ne peut pas être inférieure à l'effectif actuel (${classroom._count.enrollments} élèves).`);
    const school = await db.school.findUniqueOrThrow({ where: { id: classroom.schoolId }, select: { cycle: true } });
    const level = await db.academicLevel.findFirst({ where: { id: input.levelId, cycle: school.cycle } });
    if (!level) throw new DomainError("Ce niveau ne correspond pas au cycle de l'établissement.");
    await assertTeacherOfSchool(input.mainTeacherId, classroom.schoolId);
    try {
      await db.classroom.update({
        where: { id: classroom.id },
        data: { name: input.name, levelId: level.id, capacity: input.capacity, mainTeacherId: input.mainTeacherId },
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new DomainError(`Une classe « ${input.name} » existe déjà cette année.`);
      throw error;
    }
    await audit(user, { action: "update", resource: "class", resourceId: classroom.id, summary: `Modification de la classe ${input.name}`, schoolId: classroom.schoolId });
    return `Classe ${input.name} enregistrée.`;
  },
});

export const deleteClassroom = createAction({
  permission: "class:delete",
  schema: z.object({ id }),
  handler: async (input, user) => {
    const classroom = await findScopedClassroom(user, input.id);
    const enrolled = await db.enrollment.count({ where: { classroomId: classroom.id } });
    // Rule from ClassService::deleteClass.
    if (enrolled) throw new DomainError("Impossible de supprimer une classe contenant des élèves inscrits.");
    await db.classroom.delete({ where: { id: classroom.id } });
    await audit(user, { action: "delete", resource: "class", resourceId: classroom.id, summary: `Suppression de la classe ${classroom.name}`, schoolId: classroom.schoolId });
    invalidate(tags.stats);
    // The class page no longer exists: back to the list.
    redirect("/espace/classes");
  },
});

export const saveAssignment = createAction({
  permission: "class:update",
  schema: z.object({
    classroomId: id,
    subjectId: id,
    teacherId: optionalId,
    coefficient: intIn(1, 10, "Le coefficient"),
    weeklyHours: intIn(0, 30, "Le volume horaire"),
  }),
  handler: async (input, user) => {
    const classroom = await findScopedClassroom(user, input.classroomId);
    const subject = await db.subject.findUnique({ where: { id: input.subjectId } });
    if (!subject) throw new DomainError("Matière introuvable.");
    // Only subjects of the national catalogue approved by the ministry.
    if (subject.status !== "APPROVED") throw new DomainError("Cette matière attend la validation du ministère.");
    await assertTeacherOfSchool(input.teacherId, classroom.schoolId);
    const data = { teacherId: input.teacherId, coefficient: input.coefficient, weeklyHours: input.weeklyHours };
    const assignment = await db.courseAssignment.upsert({
      where: { classroomId_subjectId: { classroomId: classroom.id, subjectId: subject.id } },
      create: { classroomId: classroom.id, subjectId: subject.id, ...data },
      update: data,
    });
    await audit(user, {
      action: "update",
      resource: "class",
      resourceId: classroom.id,
      summary: `Matière ${subject.name} en ${classroom.name} : coefficient ${input.coefficient}, ${input.weeklyHours} h par semaine`,
      metadata: { assignmentId: assignment.id, teacherId: input.teacherId },
      schoolId: classroom.schoolId,
    });
    return `${subject.name} enregistrée pour la ${classroom.name}.`;
  },
});

export const deleteAssignment = createAction({
  permission: "class:update",
  schema: z.object({ id }),
  handler: async (input, user) => {
    const assignment = await db.courseAssignment.findFirst({
      where: { AND: [{ id: input.id }, { classroom: classroomWhere(user) }] },
      include: { subject: true, classroom: { select: { name: true, schoolId: true } } },
    });
    if (!assignment) throw new DomainError("Matière introuvable ou hors de votre périmètre.");
    await assertClassroomWritable(assignment.classroomId);
    const grades = await db.grade.count({ where: { gradeSheet: { assignmentId: assignment.id } } });
    if (grades) throw new DomainError("Des notes ont déjà été saisies pour cette matière : elle ne peut plus être retirée.");
    await db.courseAssignment.delete({ where: { id: assignment.id } });
    await audit(user, {
      action: "delete",
      resource: "class",
      resourceId: assignment.classroomId,
      summary: `Retrait de ${assignment.subject.name} en ${assignment.classroom.name}`,
      schoolId: assignment.classroom.schoolId,
    });
    return `${assignment.subject.name} retirée de la ${assignment.classroom.name}.`;
  },
});
