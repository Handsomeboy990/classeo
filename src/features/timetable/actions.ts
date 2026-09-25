"use server";

import type { Prisma } from "@/generated/prisma/client";
import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { assignmentWriteWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { assertWritable } from "@/lib/guards";
import { DAYS, describeConflict, findConflicts, isoDay, slotTimeError, type PlannedSlot } from "@/lib/domain/timetable";
import { DomainError } from "@/lib/errors";

import { cancelSlotSchema, idSchema, slotSchema, updateSlotSchema } from "./schema";

type User = NonNullable<CurrentUser>;

const assignmentSelect = {
  id: true,
  classroomId: true,
  teacherId: true,
  classroom: { select: { name: true, schoolId: true, academicYearId: true } },
  subject: { select: { name: true } },
} satisfies Prisma.CourseAssignmentSelect;

async function scopedAssignment(user: User, id: string) {
  const a = await db.courseAssignment.findFirst({ where: { AND: [{ id }, assignmentWriteWhere(user)] }, select: assignmentSelect });
  if (!a) throw new DomainError("Cours introuvable dans votre établissement.");
  // Every timetable write goes through the course or the slot below.
  await assertWritable({ schoolId: a.classroom.schoolId, academicYearId: a.classroom.academicYearId });
  return a;
}

async function scopedSlot(user: User, id: string) {
  const slot = await db.timetableSlot.findFirst({
    where: { AND: [{ id }, { assignment: assignmentWriteWhere(user) }] },
    include: { assignment: { select: assignmentSelect } },
  });
  if (!slot) throw new DomainError("Créneau introuvable.");
  await assertWritable({ schoolId: slot.assignment.classroom.schoolId, academicYearId: slot.assignment.classroom.academicYearId });
  return slot;
}

type Candidate = { id?: string; dayOfWeek: number; startTime: string; endTime: string };

// Validates times, then checks the class and the teacher are free, inside a
// transaction holding a per school lock so two planners cannot book the same
// hour at once.
async function checkAndWrite<T>(
  tx: Prisma.TransactionClient,
  assignment: Awaited<ReturnType<typeof scopedAssignment>>,
  candidate: Candidate,
  write: () => Promise<T>,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`classeo:timetable:${assignment.classroom.schoolId}`}))`;
  const existing = await tx.timetableSlot.findMany({
    where: {
      dayOfWeek: candidate.dayOfWeek,
      assignment: {
        classroom: { academicYearId: assignment.classroom.academicYearId },
        OR: [{ classroomId: assignment.classroomId }, ...(assignment.teacherId ? [{ teacherId: assignment.teacherId }] : [])],
      },
    },
    include: { assignment: { select: { classroomId: true, teacherId: true, classroom: { select: { name: true } }, subject: { select: { name: true } } } } },
  });
  const planned: PlannedSlot[] = existing.map((s) => ({
    id: s.id,
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    classroomId: s.assignment.classroomId,
    teacherId: s.assignment.teacherId,
    label: `${s.assignment.subject.name}, ${s.assignment.classroom.name}`,
  }));
  const conflicts = findConflicts({ ...candidate, classroomId: assignment.classroomId, teacherId: assignment.teacherId }, planned);
  if (conflicts.length) throw new DomainError(`Conflit d'horaire. ${conflicts.map(describeConflict).join(" ")}`);
  return write();
}

function slotSummary(a: { subject: { name: string }; classroom: { name: string } }, s: Candidate) {
  return `${a.subject.name}, ${a.classroom.name}, ${DAYS[s.dayOfWeek - 1]?.label.toLowerCase()} ${s.startTime} à ${s.endTime}`;
}

export const createSlot = createAction({
  permission: "timetable:create",
  schema: slotSchema,
  handler: async (input, user) => {
    const timeError = slotTimeError(input);
    if (timeError) throw new DomainError(timeError);
    const assignment = await scopedAssignment(user, input.assignmentId);
    const slot = await db.$transaction((tx) =>
      checkAndWrite(tx, assignment, input, () =>
        tx.timetableSlot.create({
          data: { assignmentId: assignment.id, dayOfWeek: input.dayOfWeek, startTime: input.startTime, endTime: input.endTime, room: input.room },
        }),
      ),
    );
    await audit(user, {
      action: "create",
      resource: "timetable",
      resourceId: slot.id,
      summary: `Cours ajouté : ${slotSummary(assignment, input)}`,
      schoolId: assignment.classroom.schoolId,
    });
    return "Cours ajouté à l'emploi du temps.";
  },
});

export const updateSlot = createAction({
  permission: "timetable:update",
  schema: updateSlotSchema,
  handler: async (input, user) => {
    const timeError = slotTimeError(input);
    if (timeError) throw new DomainError(timeError);
    const current = await scopedSlot(user, input.id);
    const assignment = await scopedAssignment(user, input.assignmentId);
    if (assignment.classroomId !== current.assignment.classroomId) throw new DomainError("Un créneau reste dans sa classe : choisissez une matière de cette classe.");
    await db.$transaction((tx) =>
      checkAndWrite(tx, assignment, input, () =>
        tx.timetableSlot.update({
          where: { id: current.id },
          data: { assignmentId: assignment.id, dayOfWeek: input.dayOfWeek, startTime: input.startTime, endTime: input.endTime, room: input.room },
        }),
      ),
    );
    await audit(user, {
      action: "update",
      resource: "timetable",
      resourceId: current.id,
      summary: `Cours modifié : ${slotSummary(assignment, input)}`,
      metadata: { before: { assignmentId: current.assignmentId, dayOfWeek: current.dayOfWeek, startTime: current.startTime, endTime: current.endTime, room: current.room } },
      schoolId: assignment.classroom.schoolId,
    });
    return "Cours modifié.";
  },
});

export const deleteSlot = createAction({
  permission: "timetable:delete",
  schema: idSchema,
  handler: async (input, user) => {
    const slot = await scopedSlot(user, input.id);
    await db.timetableSlot.delete({ where: { id: slot.id } });
    await audit(user, {
      action: "delete",
      resource: "timetable",
      resourceId: slot.id,
      summary: `Cours retiré : ${slotSummary(slot.assignment, slot)}`,
      schoolId: slot.assignment.classroom.schoolId,
    });
    return "Cours retiré de l'emploi du temps.";
  },
});

// A one off cancellation (teacher absent, school event): the weekly slot
// stays, only that date is marked cancelled.
export const cancelSlotOnDate = createAction({
  permission: "timetable:update",
  schema: cancelSlotSchema,
  handler: async (input, user) => {
    const slot = await scopedSlot(user, input.slotId);
    const date = new Date(`${input.date}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) throw new DomainError("Date invalide.");
    if (isoDay(date) !== slot.dayOfWeek)
      throw new DomainError(`Ce cours a lieu le ${DAYS[slot.dayOfWeek - 1]?.label.toLowerCase()} : choisissez un ${DAYS[slot.dayOfWeek - 1]?.label.toLowerCase()}.`);
    const already = await db.timetableException.count({ where: { slotId: slot.id, date, kind: "CANCELLED" } });
    if (already) throw new DomainError("Cette séance est déjà annulée.");
    const ex = await db.timetableException.create({ data: { slotId: slot.id, date, kind: "CANCELLED", note: input.note } });
    await audit(user, {
      action: "update",
      resource: "timetable",
      resourceId: slot.id,
      summary: `Séance annulée le ${input.date} : ${slotSummary(slot.assignment, slot)}`,
      metadata: { exceptionId: ex.id, note: input.note },
      schoolId: slot.assignment.classroom.schoolId,
    });
    return "Séance annulée pour cette date.";
  },
});

export const restoreSlot = createAction({
  permission: "timetable:update",
  schema: idSchema,
  handler: async (input, user) => {
    const ex = await db.timetableException.findFirst({
      where: { id: input.id, slot: { assignment: assignmentWriteWhere(user) } },
      include: { slot: { include: { assignment: { select: assignmentSelect } } } },
    });
    if (!ex) throw new DomainError("Annulation introuvable.");
    await assertWritable({ schoolId: ex.slot.assignment.classroom.schoolId, academicYearId: ex.slot.assignment.classroom.academicYearId });
    await db.timetableException.delete({ where: { id: ex.id } });
    await audit(user, {
      action: "update",
      resource: "timetable",
      resourceId: ex.slotId,
      summary: `Séance rétablie le ${ex.date.toISOString().slice(0, 10)} : ${slotSummary(ex.slot.assignment, ex.slot)}`,
      schoolId: ex.slot.assignment.classroom.schoolId,
    });
    return "Séance rétablie.";
  },
});
