import "server-only";

import { register } from "@/features/attendance/queries";
import { beninToday } from "@/features/family/logic";
import { scopedEnrollment, termGrades } from "@/features/family/queries";
import { rosterClassroomWhere } from "@/lib/auth/scope";
import { db } from "@/lib/db";
import { isIsoDate, isoToDate, todayIso } from "@/lib/domain/attendance";

import type { AttendanceSheetData, CertificateData, ClassListData, TranscriptData } from "../documents/school";
import type { PdfUser } from "../respond";

import { schoolIssuer, schoolSelect, validId } from "./common";

async function schoolOf(schoolId: string) {
  return db.school.findUniqueOrThrow({ where: { id: schoolId }, select: schoolSelect });
}

// Term transcript of a student, through scopedEnrollment(): a family reaches
// its own children, a teacher the students of their classes, staff their
// school.
export async function loadTranscript(user: PdfUser, studentId: string) {
  if (!validId(studentId)) return null;
  const enrollment = await scopedEnrollment(user, studentId);
  if (!enrollment) return null;
  const term = await termGrades(enrollment, beninToday());
  if (!term.period) return null;
  const school = await schoolOf(enrollment.schoolId);
  const data: TranscriptData = {
    student: enrollment.student,
    classroom: enrollment.classroom.name,
    yearLabel: enrollment.academicYear.label,
    periodName: term.period.name,
    average: term.average,
    subjects: term.subjects.map((s) => ({
      subject: s.subject,
      teacher: s.teacher,
      coefficient: s.coefficient,
      grades: s.grades.map((g) => ({ type: g.type, value: g.value, maxValue: g.maxValue })),
      interrogationAverage: s.interrogationAverage,
      devoirAverage: s.devoirAverage,
      compositionAverage: s.compositionAverage,
      average: s.average,
    })),
  };
  return { data, enrollmentId: enrollment.id, periodId: term.period.id, schoolId: school.id, issuer: schoolIssuer(school) };
}

// Class roster, for staff reaching the class (rosterClassroomWhere: families
// never reach a roster). Guardian phones only with the right to see parents.
export async function loadClassList(user: PdfUser, classroomId: string) {
  if (!validId(classroomId)) return null;
  const showPhones = user.permissions.has("parent:view");
  const c = await db.classroom.findFirst({
    where: { AND: [{ id: classroomId }, rosterClassroomWhere(user)] },
    select: {
      id: true,
      name: true,
      level: { select: { name: true } },
      academicYear: { select: { label: true } },
      mainTeacher: { select: { firstName: true, lastName: true } },
      school: { select: schoolSelect },
      enrollments: {
        where: { status: "ACTIVE" },
        orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
        select: {
          isRepeating: true,
          student: {
            select: {
              matricule: true,
              firstName: true,
              lastName: true,
              gender: true,
              birthDate: true,
              guardians: { orderBy: { isPrimary: "desc" }, take: showPhones ? 1 : 0, select: { guardian: { select: { firstName: true, lastName: true, phone: true } } } },
            },
          },
        },
      },
    },
  });
  if (!c) return null;
  const data: ClassListData = {
    classroom: c.name,
    level: c.level.name,
    yearLabel: c.academicYear.label,
    mainTeacher: c.mainTeacher ? `${c.mainTeacher.firstName} ${c.mainTeacher.lastName}` : null,
    showPhones,
    students: c.enrollments.map((e) => {
      const g = e.student.guardians?.[0]?.guardian;
      return {
        matricule: e.student.matricule,
        firstName: e.student.firstName,
        lastName: e.student.lastName,
        gender: e.student.gender,
        birthDate: e.student.birthDate,
        isRepeating: e.isRepeating,
        guardianPhone: g?.phone ?? null,
        guardianName: g ? `${g.firstName} ${g.lastName}` : null,
      };
    }),
  };
  return { id: c.id, data, schoolId: c.school.id, issuer: schoolIssuer(c.school) };
}

// Attendance sheet of a class for a date, both halves, through register()
// which applies rosterClassroomWhere.
export async function loadAttendanceSheet(user: PdfUser, classroomId: string, rawDate: string | null) {
  if (!validId(classroomId)) return null;
  const today = todayIso();
  const date = rawDate && isIsoDate(rawDate) ? rawDate : today;
  const [morning, afternoon] = await Promise.all([register(user, classroomId, date, "MORNING"), register(user, classroomId, date, "AFTERNOON")]);
  if (!morning || !afternoon) return null;
  const c = await db.classroom.findFirstOrThrow({
    where: { AND: [{ id: morning.classroom.id }, rosterClassroomWhere(user)] },
    select: { academicYear: { select: { label: true } }, school: { select: schoolSelect } },
  });
  const pm = new Map(afternoon.rows.map((r) => [r.enrollmentId, r]));
  const who = (r: { firstName: string; lastName: string } | null) => (r ? `${r.firstName} ${r.lastName}` : null);
  const data: AttendanceSheetData = {
    classroom: morning.classroom.name,
    date: isoToDate(date),
    yearLabel: c.academicYear.label,
    rows: morning.rows.map((r) => {
      const a = pm.get(r.enrollmentId);
      return {
        name: r.name,
        matricule: r.matricule,
        morning: { status: r.status, reason: r.reason },
        afternoon: { status: a?.status ?? null, reason: a?.reason ?? "" },
      };
    }),
    recordedBy: { morning: who(morning.recorder), afternoon: who(afternoon.recorder) },
  };
  return { id: morning.classroom.id, date, data, schoolId: c.school.id, issuer: schoolIssuer(c.school) };
}

// Certificate of enrollment for the active year, active enrollments only.
export async function loadCertificate(user: PdfUser, studentId: string) {
  if (!validId(studentId)) return null;
  const enrollment = await scopedEnrollment(user, studentId);
  if (!enrollment || enrollment.status !== "ACTIVE") return null;
  const [school, student, director] = await Promise.all([
    schoolOf(enrollment.schoolId),
    db.student.findUniqueOrThrow({ where: { id: enrollment.student.id }, select: { birthPlace: true } }),
    db.user.findFirst({
      where: { schoolId: enrollment.schoolId, isActive: true, role: { code: "SCHOOL_DIRECTOR" } },
      orderBy: { createdAt: "asc" },
      select: { firstName: true, lastName: true },
    }),
  ]);
  const data: CertificateData = {
    student: { ...enrollment.student, birthPlace: student.birthPlace },
    classroom: enrollment.classroom.name,
    level: enrollment.classroom.level.name,
    yearLabel: enrollment.academicYear.label,
    enrolledAt: enrollment.enrolledAt,
    school: { name: school.name, commune: school.commune.name },
    director: director ? `${director.firstName} ${director.lastName}` : null,
  };
  return { enrollmentId: enrollment.id, data, schoolId: school.id, issuer: schoolIssuer(school) };
}
