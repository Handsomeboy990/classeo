import "server-only";

import { transferWhere } from "@/features/transfers/queries";
import { db } from "@/lib/db";

import type { TransferCertificateData } from "../documents/attestation";
import type { PdfUser } from "../respond";

import { schoolIssuer, schoolSelect, validId } from "./common";
import { studentPhoto } from "./photo";

// Certificate of an accepted school change, issued in the name of the school
// the pupil left. Reached through transferWhere(): both schools, the family,
// and the territory above them.
export async function loadTransferCertificate(user: PdfUser, transferId: string) {
  if (!validId(transferId)) return null;
  const t = await db.studentTransfer.findFirst({
    where: { AND: [{ id: transferId, kind: "SCHOOL_CHANGE", status: "ACCEPTED" }, transferWhere(user)] },
    select: {
      id: true,
      reason: true,
      shareHistory: true,
      decidedAt: true,
      createdAt: true,
      fromClassroomId: true,
      toClassroomId: true,
      fromSchoolId: true,
      student: { select: { id: true, firstName: true, lastName: true, matricule: true, gender: true, birthDate: true, birthPlace: true, photoFileId: true } },
      fromSchool: { select: schoolSelect },
      toSchool: { select: { name: true, commune: { select: { name: true, department: { select: { name: true } } } } } },
    },
  });
  if (!t) return null;
  const leftOn = t.decidedAt ?? t.createdAt;
  const [from, to, first, director, photo] = await Promise.all([
    db.classroom.findUnique({ where: { id: t.fromClassroomId }, select: { name: true, level: { select: { name: true } }, academicYear: { select: { label: true, startDate: true } } } }),
    t.toClassroomId ? db.classroom.findUnique({ where: { id: t.toClassroomId }, select: { name: true } }) : null,
    // First school year spent in the origin school.
    db.enrollment.findFirst({
      where: { studentId: t.student.id, schoolId: t.fromSchoolId },
      orderBy: { academicYear: { startDate: "asc" } },
      select: { academicYear: { select: { startDate: true } } },
    }),
    db.user.findFirst({
      where: { schoolId: t.fromSchoolId, isActive: true, role: { code: "SCHOOL_DIRECTOR" } },
      orderBy: { createdAt: "asc" },
      select: { firstName: true, lastName: true, gender: true },
    }),
    studentPhoto(t.student.photoFileId),
  ]);
  // The enrollment of the year moved with the pupil: without an earlier year
  // in the origin school, the stay starts with the year of the class left.
  const since = first?.academicYear.startDate ?? from?.academicYear.startDate ?? t.createdAt;
  const data: TransferCertificateData = {
    student: t.student,
    photo,
    origin: { name: t.fromSchool.name, commune: t.fromSchool.commune.name },
    classroom: from?.name ?? "–",
    level: from?.level.name ?? "–",
    yearLabel: from?.academicYear.label ?? "",
    enrolledSince: since < leftOn ? since : leftOn,
    leftOn,
    destination: { name: t.toSchool.name, commune: t.toSchool.commune.name, department: t.toSchool.commune.department.name },
    destinationClassroom: to?.name ?? null,
    reason: t.reason,
    shareHistory: t.shareHistory,
    director: director ? { name: `${director.firstName} ${director.lastName}`, gender: director.gender } : null,
  };
  return { transferId: t.id, data, schoolId: t.fromSchool.id, issuer: schoolIssuer(t.fromSchool) };
}
