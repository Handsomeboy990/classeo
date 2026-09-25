import "server-only";

import { scopedEnrollment } from "@/features/family/queries";
import { db } from "@/lib/db";

import type { SchoolCertificateData } from "../documents/certificate";
import type { PdfUser } from "../respond";

import { schoolIssuer, schoolSelect, validId } from "./common";

// Certificate of schooling, through scopedEnrollment(): staff for the
// pupils of their school, a family for its own children. Active
// enrollments only.
export async function loadSchoolCertificate(user: PdfUser, studentId: string) {
  if (!validId(studentId)) return null;
  const enrollment = await scopedEnrollment(user, studentId);
  if (!enrollment || enrollment.status !== "ACTIVE") return null;
  const [school, student, director, history] = await Promise.all([
    db.school.findUniqueOrThrow({ where: { id: enrollment.schoolId }, select: schoolSelect }),
    db.student.findUniqueOrThrow({ where: { id: enrollment.student.id }, select: { birthPlace: true } }),
    db.user.findFirst({
      where: { schoolId: enrollment.schoolId, isActive: true, role: { code: "SCHOOL_DIRECTOR" } },
      orderBy: { createdAt: "asc" },
      select: { firstName: true, lastName: true, gender: true },
    }),
    db.enrollment.findMany({
      where: { studentId: enrollment.student.id, schoolId: enrollment.schoolId },
      orderBy: { academicYear: { startDate: "asc" } },
      select: { status: true, isRepeating: true, classroom: { select: { name: true, level: { select: { name: true } } } }, academicYear: { select: { label: true } } },
    }),
  ]);
  const data: SchoolCertificateData = {
    student: { ...enrollment.student, birthPlace: student.birthPlace },
    school: { name: school.name, commune: school.commune.name },
    current: { classroom: enrollment.classroom.name, level: enrollment.classroom.level.name, yearLabel: enrollment.academicYear.label },
    history: history.map((h) => ({ yearLabel: h.academicYear.label, classroom: h.classroom.name, level: h.classroom.level.name, status: h.status, isRepeating: h.isRepeating })),
    director: director ? { name: `${director.firstName} ${director.lastName}`, gender: director.gender } : null,
  };
  return { enrollmentId: enrollment.id, data, schoolId: school.id, issuer: schoolIssuer(school) };
}
