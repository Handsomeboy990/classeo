"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { checkbox, id, intIn, isUniqueViolation, requireActiveYear } from "@/features/classes/academic";
import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { assignmentWriteWhere, classroomWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { invalidate, tags } from "@/lib/cache";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";

import { sheetWriteWhere } from "./queries";

type User = NonNullable<CurrentUser>;

const formula = z.enum(["WEIGHTED_STANDARD", "SIMPLE_AVERAGE", "COMPOSITION_ONLY"], { error: "Choisissez une formule." });

const configFields = {
  formula,
  interrogationCount: intIn(1, 6, "Le nombre d'interrogations"),
  devoirCount: intIn(0, 3, "Le nombre de devoirs"),
  compositionCount: intIn(0, 2, "Le nombre de compositions"),
};

function sheetLabel(s: { assignment: { subject: { name: string }; classroom: { name: string } }; period: { name: string } }) {
  return `${s.assignment.subject.name}, ${s.assignment.classroom.name}, ${s.period.name}`;
}

const sheetInclude = {
  period: { select: { name: true, isClosed: true } },
  assignment: { select: { subject: { select: { name: true } }, classroom: { select: { id: true, name: true, schoolId: true } } } },
} as const;

async function findWritableSheet(user: User, sheetId: string) {
  const sheet = await db.gradeSheet.findFirst({ where: { AND: [{ id: sheetId }, sheetWriteWhere(user)] }, include: sheetInclude });
  if (!sheet) throw new DomainError("Fiche de notes introuvable ou hors de votre périmètre.");
  return sheet;
}

function assertEditable(sheet: { isLocked: boolean; period: { isClosed: boolean } }) {
  if (sheet.isLocked) throw new DomainError("Cette fiche est verrouillée : les notes ne peuvent plus être modifiées.");
  if (sheet.period.isClosed) throw new DomainError("Cette période est clôturée : les notes ne peuvent plus être modifiées.");
}

export const createSheet = createAction({
  permission: "grade:create",
  schema: z.object({ assignmentId: id, periodId: id, ...configFields }),
  handler: async (input, user) => {
    const year = await requireActiveYear();
    const assignment = await db.courseAssignment.findFirst({
      where: { AND: [{ id: input.assignmentId }, assignmentWriteWhere(user), { classroom: classroomWhere(user) }, { classroom: { academicYearId: year.id } }] },
      include: { subject: true, classroom: { select: { name: true, schoolId: true } } },
    });
    if (!assignment) throw new DomainError("Matière introuvable ou hors de votre périmètre.");
    const period = year.periods.find((p) => p.id === input.periodId);
    if (!period) throw new DomainError("Période inconnue pour l'année scolaire active.");
    if (period.isClosed) throw new DomainError("Cette période est clôturée.");
    let sheetId: string;
    try {
      const sheet = await db.gradeSheet.create({
        data: {
          assignmentId: assignment.id,
          periodId: period.id,
          formula: input.formula,
          interrogationCount: input.interrogationCount,
          devoirCount: input.devoirCount,
          compositionCount: input.compositionCount,
        },
      });
      await audit(user, {
        action: "create",
        resource: "grade",
        resourceId: sheet.id,
        summary: `Création de la fiche de notes ${assignment.subject.name}, ${assignment.classroom.name}, ${period.name}`,
        schoolId: assignment.classroom.schoolId,
      });
      sheetId = sheet.id;
    } catch (error) {
      if (isUniqueViolation(error)) throw new DomainError("Une fiche existe déjà pour cette matière et cette période.");
      throw error;
    }
    // Straight to the entry grid.
    redirect(`/espace/notes/${sheetId}`);
  },
});

export const updateSheet = createAction({
  permission: "grade:update",
  schema: z.object({ id, ...configFields }),
  handler: async (input, user) => {
    const sheet = await findWritableSheet(user, input.id);
    assertEditable(sheet);
    // Reducing a count must not silently hide grades already entered.
    const beyond = await db.grade.count({
      where: {
        gradeSheetId: sheet.id,
        OR: [
          { type: "INTERROGATION", sequence: { gt: input.interrogationCount } },
          { type: "DEVOIR", sequence: { gt: input.devoirCount } },
          { type: "COMPOSITION", sequence: { gt: input.compositionCount } },
        ],
      },
    });
    if (beyond) throw new DomainError(`${beyond} note(s) déjà saisie(s) seraient masquées : effacez-les avant de réduire le nombre d'évaluations.`);
    await db.gradeSheet.update({
      where: { id: sheet.id },
      data: { formula: input.formula, interrogationCount: input.interrogationCount, devoirCount: input.devoirCount, compositionCount: input.compositionCount },
    });
    await audit(user, { action: "update", resource: "grade", resourceId: sheet.id, summary: `Paramètres de la fiche ${sheetLabel(sheet)}`, metadata: input, schoolId: sheet.assignment.classroom.schoolId });
    invalidate(tags.stats);
    return "Paramètres de la fiche enregistrés.";
  },
});

export const deleteSheet = createAction({
  permission: "grade:delete",
  schema: z.object({ id }),
  handler: async (input, user) => {
    const sheet = await findWritableSheet(user, input.id);
    assertEditable(sheet);
    const grades = await db.grade.count({ where: { gradeSheetId: sheet.id } });
    if (grades) throw new DomainError("Cette fiche contient des notes : effacez-les avant de la supprimer.");
    await db.gradeSheet.delete({ where: { id: sheet.id } });
    await audit(user, { action: "delete", resource: "grade", resourceId: sheet.id, summary: `Suppression de la fiche ${sheetLabel(sheet)}`, schoolId: sheet.assignment.classroom.schoolId });
    // The sheet page no longer exists: back to the list.
    redirect(`/espace/notes?classe=${sheet.assignment.classroom.id}`);
  },
});

const cell = z.object({
  enrollmentId: id,
  type: z.enum(["INTERROGATION", "DEVOIR", "COMPOSITION"]),
  sequence: z.number().int().min(1).max(6),
  value: z
    .number()
    .min(0, "Une note est comprise entre 0 et 20.")
    .max(20, "Une note est comprise entre 0 et 20.")
    .refine((v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6, "Deux décimales au maximum.")
    .nullable(),
});

// Bulk save of the entry grid: only the changed cells travel. An empty cell
// deletes the grade. Everything is written in one transaction.
export const saveGrades = createAction({
  permission: "grade:update",
  schema: z.object({ sheetId: id, cells: z.array(cell).min(1, "Aucune modification à enregistrer.").max(3000) }),
  handler: async (input, user) => {
    const sheet = await findWritableSheet(user, input.sheetId);
    assertEditable(sheet);

    const counts = { INTERROGATION: sheet.interrogationCount, DEVOIR: sheet.devoirCount, COMPOSITION: sheet.compositionCount };
    if (input.cells.some((c) => c.sequence > counts[c.type])) throw new DomainError("Une évaluation ne fait pas partie de cette fiche.");
    const enrollmentIds = [...new Set(input.cells.map((c) => c.enrollmentId))];
    const valid = await db.enrollment.count({ where: { id: { in: enrollmentIds }, classroomId: sheet.assignment.classroom.id, status: "ACTIVE" } });
    if (valid !== enrollmentIds.length) throw new DomainError("Un élève ne fait pas partie de cette classe.");

    const cleared = input.cells.filter((c) => c.value === null);
    const written = input.cells.filter((c) => c.value !== null);
    await db.$transaction([
      ...(cleared.length
        ? [
            db.grade.deleteMany({
              where: { gradeSheetId: sheet.id, OR: cleared.map((c) => ({ enrollmentId: c.enrollmentId, type: c.type, sequence: c.sequence })) },
            }),
          ]
        : []),
      ...written.map((c) =>
        db.grade.upsert({
          where: { gradeSheetId_enrollmentId_type_sequence: { gradeSheetId: sheet.id, enrollmentId: c.enrollmentId, type: c.type, sequence: c.sequence } },
          create: { gradeSheetId: sheet.id, enrollmentId: c.enrollmentId, type: c.type, sequence: c.sequence, value: c.value!, gradedById: user.id },
          update: { value: c.value!, gradedById: user.id },
        }),
      ),
    ]);

    await audit(user, {
      action: "update",
      resource: "grade",
      resourceId: sheet.id,
      summary: `Saisie de notes ${sheetLabel(sheet)} : ${written.length} enregistrée(s), ${cleared.length} effacée(s)`,
      schoolId: sheet.assignment.classroom.schoolId,
    });
    invalidate(tags.stats);
    const n = input.cells.length;
    return `${n} note${n > 1 ? "s" : ""} enregistrée${n > 1 ? "s" : ""}.`;
  },
});

export const setSheetLock = createAction({
  permission: "grade:lock",
  schema: z.object({ id, lock: checkbox }),
  handler: async (input, user) => {
    const sheet = await findWritableSheet(user, input.id);
    await db.gradeSheet.update({
      where: { id: sheet.id },
      data: input.lock ? { isLocked: true, lockedAt: new Date(), lockedById: user.id } : { isLocked: false, lockedAt: null, lockedById: null },
    });
    await audit(user, {
      action: "lock",
      resource: "grade",
      resourceId: sheet.id,
      summary: `${input.lock ? "Verrouillage" : "Déverrouillage"} de la fiche ${sheetLabel(sheet)}`,
      schoolId: sheet.assignment.classroom.schoolId,
    });
    return input.lock ? "Fiche verrouillée : les notes sont figées." : "Fiche déverrouillée : la saisie est de nouveau possible.";
  },
});

// Lock or unlock every sheet of a class for a period
// (GradeService::bulkLockGradeSheets).
export const setClassLock = createAction({
  permission: "grade:lock",
  schema: z.object({ classroomId: id, periodId: id, lock: checkbox }),
  handler: async (input, user) => {
    const classroom = await db.classroom.findFirst({ where: { AND: [{ id: input.classroomId }, classroomWhere(user)] }, select: { id: true, name: true, schoolId: true } });
    if (!classroom) throw new DomainError("Classe introuvable ou hors de votre périmètre.");
    const { count } = await db.gradeSheet.updateMany({
      where: { AND: [sheetWriteWhere(user), { periodId: input.periodId, isLocked: !input.lock, assignment: { classroomId: classroom.id } }] },
      data: input.lock ? { isLocked: true, lockedAt: new Date(), lockedById: user.id } : { isLocked: false, lockedAt: null, lockedById: null },
    });
    await audit(user, {
      action: "lock",
      resource: "grade",
      resourceId: classroom.id,
      summary: `${input.lock ? "Verrouillage" : "Déverrouillage"} de ${count} fiche(s) de la ${classroom.name}`,
      schoolId: classroom.schoolId,
    });
    if (!count) return input.lock ? "Toutes les fiches de la classe étaient déjà verrouillées." : "Aucune fiche verrouillée dans cette classe.";
    return `${count} fiche${count > 1 ? "s" : ""} ${input.lock ? "verrouillée" : "déverrouillée"}${count > 1 ? "s" : ""} pour la ${classroom.name}.`;
  },
});
