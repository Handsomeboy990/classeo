import "server-only";

import { forbidden } from "next/navigation";
import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";
import { can } from "@/lib/auth/authorize";
import { enrollmentWhere } from "@/lib/auth/scope";
import { requireUser, type CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { generalAverage, subjectAverage } from "@/lib/domain/grades";

import { beninToday, parseReportLines, sortSlots, weekRange, type SchoolDay } from "./logic";
import { allowedSections, SECTION_PERMISSIONS, type StudentFileSection } from "./sections";

// Reads of the family space. Every query that reaches a student goes through
// enrollmentWhere(user): a parent reaches only their children, a student only
// themselves, whatever identifier is sent in the URL.

type User = NonNullable<CurrentUser>;

export const activeYear = cache(async () =>
  db.academicYear.findFirst({ where: { isActive: true }, include: { periods: { orderBy: { order: "asc" } } } }),
);

type Period = { id: string; name: string; order: number; startDate: Date; endDate: Date };

// The period running today, else the last one started, else the first.
export function currentPeriod<P extends Period>(periods: P[], today: SchoolDay): P | null {
  const t = new Date(`${today.iso}T12:00:00.000Z`).getTime();
  const running = periods.find((p) => p.startDate.getTime() <= t && t <= p.endDate.getTime() + 86_400_000);
  if (running) return running;
  const started = periods.filter((p) => p.startDate.getTime() <= t);
  return started.at(-1) ?? periods[0] ?? null;
}

const enrollmentInclude = {
  student: { select: { id: true, firstName: true, lastName: true, gender: true, matricule: true, birthDate: true, photoFileId: true } },
  classroom: { select: { id: true, name: true, level: { select: { name: true } } } },
  school: { select: { id: true, name: true, communeId: true, commune: { select: { name: true, departmentId: true } } } },
  academicYear: { select: { id: true, label: true } },
} satisfies Prisma.EnrollmentInclude;

export type FamilyEnrollment = Prisma.EnrollmentGetPayload<{ include: typeof enrollmentInclude }>;

// Children followed by a parent, or the student themselves, this school year.
export async function followedEnrollments(user: User): Promise<FamilyEnrollment[]> {
  const year = await activeYear();
  if (!year) return [];
  return db.enrollment.findMany({
    where: { AND: [enrollmentWhere(user), { academicYearId: year.id, status: "ACTIVE" }] },
    include: enrollmentInclude,
    orderBy: [{ student: { birthDate: "asc" } }, { student: { firstName: "asc" } }],
  });
}

// The IDOR guard of /espace/suivi/[studentId]: the enrollment is looked up
// through the scope filter, so an identifier outside the user's scope finds
// nothing, exactly like an identifier that does not exist.
export async function scopedEnrollment(user: User, studentId: string): Promise<FamilyEnrollment | null> {
  const year = await activeYear();
  if (!year || typeof studentId !== "string" || studentId.length > 64) return null;
  return db.enrollment.findFirst({
    where: { AND: [enrollmentWhere(user), { studentId, academicYearId: year.id }] },
    include: enrollmentInclude,
  });
}

// For pages: the signed in user and the student file they may open, or the
// 403 page. Shared by the layout and the page of a request.
export const requireStudentFile = cache(async (studentId: string) => {
  const user = await requireUser();
  if (!can(user, "report_card:view") && !can(user, "student:view")) forbidden();
  if (!allowedSections(user.permissions).length) forbidden();
  const enrollment = await scopedEnrollment(user, studentId);
  if (!enrollment) forbidden();
  return { user, enrollment };
});

// For each section page: the student file, and the right of what the section
// shows (grades, attendance, report cards, timetable, fees), or the 403 page.
export async function requireStudentSection(studentId: string, section: StudentFileSection) {
  const file = await requireStudentFile(studentId);
  if (!can(file.user, SECTION_PERMISSIONS[section])) forbidden();
  return file;
}

// Published report cards of a student, every school year, newest first.
export async function reportCardsOf(user: User, studentId: string) {
  const cards = await db.reportCard.findMany({
    where: { enrollment: { AND: [enrollmentWhere(user), { studentId }] } },
    include: {
      period: { select: { name: true, order: true, academicYear: { select: { label: true } } } },
      enrollment: { select: { classroom: { select: { name: true } }, school: { select: { name: true } } } },
    },
    orderBy: [{ period: { academicYear: { startDate: "desc" } } }, { period: { order: "desc" } }],
  });
  return cards.map((c) => ({
    id: c.id,
    periodLabel: `${c.period.name} ${c.period.academicYear.label}`,
    periodName: c.period.name,
    yearLabel: c.period.academicYear.label,
    classroom: c.enrollment.classroom.name,
    school: c.enrollment.school.name,
    average: c.generalAverage === null ? null : Number(c.generalAverage),
    rank: c.rank,
    classSize: c.classSize,
    appreciation: c.appreciation,
    publishedAt: c.publishedAt,
    lines: parseReportLines(c.lines),
  }));
}

export type ReportCardView = Awaited<ReturnType<typeof reportCardsOf>>[number];

export async function lastReportCard(user: User, studentId: string) {
  const card = await db.reportCard.findFirst({
    where: { enrollment: { AND: [enrollmentWhere(user), { studentId }] } },
    include: { period: { select: { name: true, academicYear: { select: { label: true } } } } },
    orderBy: [{ period: { academicYear: { startDate: "desc" } } }, { period: { order: "desc" } }],
  });
  if (!card) return null;
  return {
    average: card.generalAverage === null ? null : Number(card.generalAverage),
    periodLabel: `${card.period.name} ${card.period.academicYear.label}`,
  };
}

// Grades of the running period, per subject, with the averages computed by
// the domain rules (never stored, never recomputed differently here).
export async function termGrades(enrollment: FamilyEnrollment, today: SchoolDay = beninToday()) {
  const year = await activeYear();
  const period = year ? currentPeriod(year.periods, today) : null;
  if (!period) return { period: null, subjects: [], average: null };
  const assignments = await db.courseAssignment.findMany({
    where: { classroomId: enrollment.classroomId },
    include: {
      subject: { select: { name: true } },
      teacher: { select: { firstName: true, lastName: true } },
      gradeSheets: {
        where: { periodId: period.id },
        include: { grades: { where: { enrollmentId: enrollment.id }, orderBy: [{ type: "asc" }, { sequence: "asc" }] } },
      },
    },
    orderBy: [{ coefficient: "desc" }, { subject: { name: "asc" } }],
  });
  const subjects = assignments.map((a) => {
    const sheet = a.gradeSheets[0];
    const grades = (sheet?.grades ?? []).map((g) => ({ type: g.type, sequence: g.sequence, value: Number(g.value), maxValue: Number(g.maxValue) }));
    const breakdown = subjectAverage(sheet?.formula ?? "WEIGHTED_STANDARD", grades);
    return {
      id: a.id,
      subject: a.subject.name,
      teacher: a.teacher ? `${a.teacher.firstName} ${a.teacher.lastName}` : null,
      coefficient: a.coefficient,
      grades,
      ...breakdown,
    };
  });
  return { period, subjects, average: generalAverage(subjects) };
}

export async function attendanceOf(enrollment: FamilyEnrollment) {
  return db.studentAttendance.findMany({
    where: { enrollmentId: enrollment.id },
    select: { id: true, date: true, half: true, status: true, reason: true },
    orderBy: [{ date: "desc" }, { half: "asc" }],
  });
}

export async function weekAttendance(enrollment: FamilyEnrollment, today: SchoolDay = beninToday()) {
  const { start, end } = weekRange(today);
  return db.studentAttendance.findMany({
    where: { enrollmentId: enrollment.id, date: { gte: start, lt: end } },
    select: { date: true, half: true, status: true, reason: true },
  });
}

export async function timetableOf(enrollment: FamilyEnrollment) {
  const slots = await db.timetableSlot.findMany({
    where: { assignment: { classroomId: enrollment.classroomId } },
    select: {
      id: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      room: true,
      assignment: { select: { subject: { select: { name: true } }, teacher: { select: { firstName: true, lastName: true } } } },
    },
  });
  return sortSlots(
    slots.map((s) => ({
      id: s.id,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      room: s.room,
      subject: s.assignment.subject.name,
      teacher: s.assignment.teacher ? `${s.assignment.teacher.firstName} ${s.assignment.teacher.lastName}` : null,
    })),
  );
}

export type SlotView = Awaited<ReturnType<typeof timetableOf>>[number];

export async function invoicesOf(enrollment: FamilyEnrollment) {
  return db.invoice.findMany({
    where: { enrollmentId: enrollment.id, status: { not: "CANCELLED" } },
    include: {
      items: { select: { id: true, description: true, quantity: true, unitPrice: true } },
      installments: { orderBy: { order: "asc" } },
      payments: { select: { id: true, reference: true, amount: true, method: true, paidAt: true }, orderBy: { paidAt: "desc" } },
    },
    orderBy: { issueDate: "desc" },
  });
}

// Content targeting (schema rule): the most specific non null target wins,
// no target at all means national reach.
function reachesEnrollment(e: FamilyEnrollment): Prisma.ContentWhereInput {
  return {
    OR: [
      { classroomId: e.classroomId },
      { classroomId: null, schoolId: e.schoolId },
      { classroomId: null, schoolId: null, communeId: e.school.communeId },
      { classroomId: null, schoolId: null, communeId: null, departmentId: e.school.commune.departmentId },
      { classroomId: null, schoolId: null, communeId: null, departmentId: null },
    ],
  };
}

function audienceFor(user: User): Prisma.ContentWhereInput {
  return { audience: { in: user.guardianId ? ["EVERYONE", "PARENTS"] : ["EVERYONE", "STUDENTS"] } };
}

export async function upcomingEvents(user: User, enrollments: FamilyEnrollment[], today: SchoolDay = beninToday()) {
  if (!enrollments.length) return [];
  return db.content.findMany({
    where: {
      AND: [
        { type: "EVENT", status: "PUBLISHED", eventDate: { gte: new Date(`${today.iso}T00:00:00.000Z`) } },
        audienceFor(user),
        { OR: enrollments.map(reachesEnrollment) },
      ],
    },
    select: { id: true, title: true, easyRead: true, body: true, eventDate: true, school: { select: { name: true } } },
    orderBy: { eventDate: "asc" },
    take: 5,
  });
}

export async function classResources(user: User, enrollment: FamilyEnrollment) {
  return db.content.findMany({
    where: { AND: [{ type: "RESOURCE", status: "PUBLISHED" }, audienceFor(user), reachesEnrollment(enrollment)] },
    select: { id: true, title: true, easyRead: true, subjectLabel: true, mediaType: true, transcript: true, publishedAt: true },
    orderBy: { publishedAt: "desc" },
    take: 6,
  });
}

// Messages written by others after the user last opened each conversation.
export async function unreadMessageCount(user: User) {
  const parts = await db.conversationParticipant.findMany({ where: { userId: user.id }, select: { conversationId: true, lastReadAt: true } });
  if (!parts.length) return 0;
  return db.message.count({
    where: {
      senderId: { not: user.id },
      OR: parts.map((p) => ({ conversationId: p.conversationId, ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}) })),
    },
  });
}
