"use server";

import { z } from "zod";

import { id, requireActiveYear } from "@/features/classes/academic";
import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/authorize";
import { classroomWhere, schoolWhere } from "@/lib/auth/scope";
import { invalidate, tags } from "@/lib/cache";
import { ATTENDANCE_LABELS, isIsoDate, isoToDate, newAbsences, todayIso } from "@/lib/domain/attendance";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { plural } from "@/features/classes/text";
import { withSubmission } from "@/features/offline/submission";

const status = z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]);
const reason = z
  .string()
  .trim()
  .max(200, "200 caractères au maximum.")
  .optional()
  .transform((v) => v || null);
const date = z.string().refine(isIsoDate, "Date invalide.");

async function assertSchoolDay(iso: string) {
  if (iso > todayIso()) throw new DomainError("On ne peut pas faire l'appel d'un jour à venir.");
  const year = await requireActiveYear();
  const d = isoToDate(iso);
  if (d < year.startDate || d > year.endDate) throw new DomainError(`Cette date est hors de l'année scolaire ${year.label}.`);
  return year;
}

function frenchDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(isoToDate(iso));
}

// Saves the whole register of a class for a half day in one transaction, then
// alerts the families of students newly marked absent.
export const saveAttendance = createAction({
  permission: "attendance:create",
  schema: z.object({
    classroomId: id,
    date,
    half: z.enum(["MORNING", "AFTERNOON"]),
    records: z.array(z.object({ enrollmentId: id, status, reason })).min(1, "Aucun élève dans l'appel.").max(200),
    // Set by a register taken offline and replayed (/api/offline/replay).
    clientId: z.uuid().optional(),
  }),
  handler: (input, user) =>
    withSubmission(user, input.clientId, "attendance", async () => {
    const year = await assertSchoolDay(input.date);
    const classroom = await db.classroom.findFirst({
      where: { AND: [{ id: input.classroomId }, classroomWhere(user), { academicYearId: year.id }] },
      select: { id: true, name: true, schoolId: true },
    });
    if (!classroom) throw new DomainError("Classe introuvable ou hors de votre périmètre.");
    const ids = [...new Set(input.records.map((r) => r.enrollmentId))];
    if (ids.length !== input.records.length) throw new DomainError("Un élève apparaît deux fois dans l'appel.");
    const enrollments = await db.enrollment.findMany({
      where: { id: { in: ids }, classroomId: classroom.id, status: "ACTIVE" },
      select: { id: true, student: { select: { firstName: true, lastName: true, userId: true, guardians: { select: { guardian: { select: { userId: true } } } } } } },
    });
    if (enrollments.length !== ids.length) throw new DomainError("Un élève ne fait pas partie de cette classe.");

    const day = isoToDate(input.date);
    const previous = new Map(
      (await db.studentAttendance.findMany({ where: { enrollmentId: { in: ids }, date: day, half: input.half }, select: { enrollmentId: true, status: true } })).map((p) => [
        p.enrollmentId,
        p.status,
      ]),
    );

    await db.$transaction(
      input.records.map((r) => {
        const data = { status: r.status, reason: r.status === "PRESENT" ? null : r.reason, recordedById: user.id };
        return db.studentAttendance.upsert({
          where: { enrollmentId_date_half: { enrollmentId: r.enrollmentId, date: day, half: input.half } },
          create: { enrollmentId: r.enrollmentId, date: day, half: input.half, ...data },
          update: data,
        });
      }),
    );

    const halfLabel = input.half === "MORNING" ? "matin" : "après-midi";
    const byId = new Map(enrollments.map((e) => [e.id, e]));
    const fresh = newAbsences(input.records, previous);
    for (const r of fresh) {
      const s = byId.get(r.enrollmentId)!.student;
      const recipients = [...s.guardians.map((g) => g.guardian.userId), s.userId].filter((u): u is string => !!u);
      await notify(recipients, {
        kind: "absence",
        title: `Absence de ${s.firstName}`,
        body: `${s.firstName} ${s.lastName} a été noté(e) absent(e) le ${frenchDate(input.date)} (${halfLabel}) en ${classroom.name}.${r.reason ? ` Motif : ${r.reason}.` : ""}`,
        link: "/espace/suivi",
      });
    }

    const counts = input.records.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
    await audit(user, {
      action: previous.size ? "update" : "create",
      resource: "attendance",
      resourceId: classroom.id,
      summary: `Appel ${classroom.name}, ${input.date} ${halfLabel} : ${Object.entries(counts)
        .map(([k, v]) => `${v} ${ATTENDANCE_LABELS[k as keyof typeof ATTENDANCE_LABELS].toLowerCase()}`)
        .join(", ")}`,
      schoolId: classroom.schoolId,
    });
    invalidate(tags.stats);
    const absent = counts.ABSENT ?? 0;
    return `Appel enregistré pour la ${classroom.name} : ${plural(input.records.length - absent, "présent ou excusé", "présents ou excusés")}, ${plural(absent, "absent", "absents")}.${
      fresh.length ? ` ${plural(fresh.length, "famille prévenue", "familles prévenues")}.` : ""
    }`;
    }),
});

// Staff attendance. Recording it is a staff management task: it needs the
// right to manage teachers on top of the right to take attendance.
export const saveTeacherAttendance = createAction({
  permission: "teacher:update",
  schema: z.object({
    date,
    records: z.array(z.object({ teacherId: id, status, reason })).min(1).max(300),
  }),
  handler: async (input, user) => {
    if (!can(user, "attendance:create")) throw new DomainError("Vous n'avez pas le droit d'enregistrer les présences.");
    await assertSchoolDay(input.date);
    const ids = [...new Set(input.records.map((r) => r.teacherId))];
    const teachers = await db.teacher.findMany({ where: { id: { in: ids }, isActive: true, school: schoolWhere(user) }, select: { id: true, schoolId: true } });
    if (teachers.length !== ids.length || ids.length !== input.records.length) throw new DomainError("Un enseignant est hors de votre périmètre.");
    const day = isoToDate(input.date);
    await db.$transaction(
      input.records.map((r) => {
        const data = { status: r.status, reason: r.status === "PRESENT" ? null : r.reason };
        return db.teacherAttendance.upsert({
          where: { teacherId_date: { teacherId: r.teacherId, date: day } },
          create: { teacherId: r.teacherId, date: day, ...data },
          update: data,
        });
      }),
    );
    const absent = input.records.filter((r) => r.status === "ABSENT").length;
    await audit(user, {
      action: "update",
      resource: "attendance",
      summary: `Présence des enseignants du ${input.date} : ${input.records.length - absent} présent(s), ${absent} absent(s)`,
      schoolId: teachers[0]?.schoolId,
    });
    invalidate(tags.stats);
    return `Présence des enseignants enregistrée : ${plural(absent, "absent", "absents")}.`;
  },
});
