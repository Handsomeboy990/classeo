import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { classroomWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { addDays } from "@/lib/domain/timetable";

type User = NonNullable<CurrentUser>;

export type SlotView = {
  id: string;
  assignmentId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  subject: string;
  subjectCode: string;
  teacher: string | null;
  classroom: string;
  classroomId: string;
  cancellation: { id: string; date: string; note: string | null } | null;
};

const slotInclude = (monday: Date) =>
  ({
    assignment: {
      select: {
        classroomId: true,
        classroom: { select: { name: true } },
        subject: { select: { name: true, code: true } },
        teacher: { select: { firstName: true, lastName: true } },
      },
    },
    exceptions: { where: { kind: "CANCELLED", date: { gte: monday, lte: addDays(monday, 6) } }, orderBy: { date: "asc" as const } },
  }) satisfies Prisma.TimetableSlotInclude;

type SlotRow = Prisma.TimetableSlotGetPayload<{ include: ReturnType<typeof slotInclude> }>;

function toView(s: SlotRow): SlotView {
  const ex = s.exceptions[0];
  const t = s.assignment.teacher;
  return {
    id: s.id,
    assignmentId: s.assignmentId,
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    room: s.room,
    subject: s.assignment.subject.name,
    subjectCode: s.assignment.subject.code,
    teacher: t ? `${t.firstName} ${t.lastName}` : null,
    classroom: s.assignment.classroom.name,
    classroomId: s.assignment.classroomId,
    cancellation: ex ? { id: ex.id, date: ex.date.toISOString().slice(0, 10), note: ex.note } : null,
  };
}

const order = [{ dayOfWeek: "asc" as const }, { startTime: "asc" as const }];

async function activeYearId() {
  const year = await db.academicYear.findFirst({ where: { isActive: true }, select: { id: true, label: true } });
  return year;
}

export function isTeacherView(user: User) {
  return user.role.code === "TEACHER" && !!user.teacherId;
}

// The teacher's own week, across all the classes they teach.
export async function getTeacherTimetable(user: User, monday: Date) {
  const year = await activeYearId();
  const slots = await db.timetableSlot.findMany({
    where: { assignment: { teacherId: user.teacherId ?? "__none__", classroom: { academicYearId: year?.id ?? "__none__" } } },
    include: slotInclude(monday),
    orderBy: order,
  });
  return { year, slots: slots.map(toView) };
}

// Classes the user may open, in level order.
export async function getTimetableClasses(user: User) {
  const year = await activeYearId();
  if (!year) return { year: null, classes: [] };
  const classes = await db.classroom.findMany({
    where: { AND: [classroomWhere(user), { academicYearId: year.id }] },
    orderBy: [{ level: { order: "asc" } }, { name: "asc" }],
    select: { id: true, name: true },
    take: 300,
  });
  return { year, classes };
}

export async function getClassTimetable(classroomId: string, monday: Date) {
  const [slots, assignments] = await Promise.all([
    db.timetableSlot.findMany({ where: { assignment: { classroomId } }, include: slotInclude(monday), orderBy: order }),
    db.courseAssignment.findMany({
      where: { classroomId },
      orderBy: { subject: { name: "asc" } },
      select: { id: true, subject: { select: { name: true } }, teacher: { select: { firstName: true, lastName: true } } },
    }),
  ]);
  return {
    slots: slots.map(toView),
    assignments: assignments.map((a) => ({
      id: a.id,
      label: `${a.subject.name}${a.teacher ? ` · ${a.teacher.firstName} ${a.teacher.lastName}` : " · sans enseignant"}`,
    })),
  };
}
