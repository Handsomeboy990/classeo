import "server-only";

import { loadTimetable } from "@/features/timetable/load";
import type { SlotView } from "@/features/timetable/queries";
import { isTeacherRole, schoolWhere } from "@/lib/auth/scope";
import { db } from "@/lib/db";
import { addDays, weekMonday } from "@/lib/domain/timetable";

import type { TimetableData, TimetableSlot } from "../documents/timetable";
import type { PdfUser } from "../respond";

import { schoolIssuer, schoolSelect, validId } from "./common";

function fromView(s: SlotView, kind: "class" | "teacher"): TimetableSlot {
  return {
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    subject: s.subject,
    detail: kind === "class" ? s.teacher : s.classroom,
    room: s.room,
    cancelledOn: s.cancellation?.date ?? null,
  };
}

function weekOf(raw: string | null) {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const ref = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(new Date(`${raw}T00:00:00Z`).getTime()) ? new Date(`${raw}T00:00:00Z`) : today;
  return weekMonday(ref);
}

// A teacher's week for school staff (?enseignant=): the teacher must belong
// to a school of the user's scope. A teacher account only prints its own
// week, through loadTimetable().
async function staffTeacherWeek(user: PdfUser, teacherId: string, rawWeek: string | null) {
  if (!validId(teacherId) || isTeacherRole(user) || user.scope.level === "SELF") return null;
  const teacher = await db.teacher.findFirst({
    where: { AND: [{ id: teacherId }, { school: schoolWhere(user) }] },
    select: { id: true, firstName: true, lastName: true, school: { select: schoolSelect } },
  });
  if (!teacher) return null;
  const year = await db.academicYear.findFirst({ where: { isActive: true }, select: { id: true, label: true } });
  const monday = weekOf(rawWeek);
  const slots = await db.timetableSlot.findMany({
    where: { assignment: { teacherId: teacher.id, classroom: { academicYearId: year?.id ?? "__none__" } } },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    select: {
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      room: true,
      assignment: { select: { subject: { select: { name: true } }, classroom: { select: { name: true } } } },
      exceptions: { where: { kind: "CANCELLED", date: { gte: monday, lte: addDays(monday, 6) } }, select: { date: true }, take: 1 },
    },
  });
  const data: TimetableData = {
    who: `${teacher.firstName} ${teacher.lastName}`,
    kind: "teacher",
    yearLabel: year?.label ?? null,
    monday,
    saturday: addDays(monday, 5),
    slots: slots.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      subject: s.assignment.subject.name,
      detail: s.assignment.classroom.name,
      room: s.room,
      cancelledOn: s.exceptions[0]?.date.toISOString().slice(0, 10) ?? null,
    })),
  };
  return { subjectId: teacher.id, data, schoolId: teacher.school.id, issuer: schoolIssuer(teacher.school) };
}

// The week printed by the timetable page: a class the user may open
// (families: their children's classes) or, for a teacher, their own week.
export async function loadTimetablePdf(user: PdfUser, sp: URLSearchParams) {
  const teacherId = sp.get("enseignant");
  if (teacherId) return staffTeacherWeek(user, teacherId, sp.get("semaine"));

  const t = await loadTimetable(user, { classe: sp.get("classe") ?? undefined, semaine: sp.get("semaine") ?? undefined });
  if (t.mode === "unavailable") return null;
  if (t.mode === "class" && !t.selected) return null;
  // A requested class the user may not open is refused, never replaced by
  // another class.
  const requested = sp.get("classe");
  if (t.mode === "class" && requested && t.selected?.id !== requested) return null;

  const schoolId =
    t.mode === "teacher"
      ? user.scope.schoolId
      : (await db.classroom.findUnique({ where: { id: t.selected!.id }, select: { schoolId: true } }))?.schoolId;
  if (!schoolId) return null;
  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: schoolSelect });
  const kind = t.mode === "teacher" ? "teacher" : "class";
  const data: TimetableData = {
    who: kind === "teacher" ? user.fullName : `Classe de ${t.selected!.name}`,
    kind,
    yearLabel: t.yearLabel,
    monday: t.monday,
    saturday: addDays(t.monday, 5),
    slots: t.slots.map((s) => fromView(s, kind)),
  };
  return { subjectId: kind === "teacher" ? (user.teacherId ?? user.id) : t.selected!.id, data, schoolId: school.id, issuer: schoolIssuer(school) };
}
