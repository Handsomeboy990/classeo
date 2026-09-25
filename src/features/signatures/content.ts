import "server-only";

import { db } from "@/lib/db";

import { contentHash, type SignableKind } from "@/features/verification/reference";

// What a signature seals, per document: the facts the document certifies,
// read from the database the same way when the head signs and when a copy
// is printed. The hash of this content is stored with the signature; a copy
// is printed signed only while the content is unchanged.
//
// Subjects: an enrollment for the attestation and the certificate (one per
// school year), a report card for the bulletin.

const studentFacts = { matricule: true, firstName: true, lastName: true, gender: true, birthDate: true, birthPlace: true } as const;

async function attestationContent(enrollmentId: string) {
  const e = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      status: true,
      student: { select: studentFacts },
      classroom: { select: { name: true, level: { select: { name: true } } } },
      academicYear: { select: { label: true } },
      school: { select: { code: true, name: true } },
    },
  });
  if (!e || e.status !== "ACTIVE") return null;
  return { enrollmentId: e.id, student: e.student, classroom: e.classroom.name, level: e.classroom.level.name, year: e.academicYear.label, school: e.school };
}

async function certificateContent(enrollmentId: string) {
  const base = await attestationContent(enrollmentId);
  if (!base) return null;
  const e = await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId }, select: { studentId: true, schoolId: true } });
  const history = await db.enrollment.findMany({
    where: { studentId: e.studentId, schoolId: e.schoolId },
    orderBy: { academicYear: { startDate: "asc" } },
    select: { status: true, isRepeating: true, classroom: { select: { name: true } }, academicYear: { select: { label: true } } },
  });
  return { ...base, history: history.map((h) => ({ year: h.academicYear.label, classroom: h.classroom.name, status: h.status, repeating: h.isRepeating })) };
}

async function bulletinContent(reportCardId: string) {
  const c = await db.reportCard.findUnique({
    where: { id: reportCardId },
    select: {
      id: true,
      generalAverage: true,
      rank: true,
      classSize: true,
      appreciation: true,
      lines: true,
      publishedAt: true,
      period: { select: { name: true } },
      enrollment: { select: { student: { select: studentFacts }, classroom: { select: { name: true } }, academicYear: { select: { label: true } }, school: { select: { code: true, name: true } } } },
    },
  });
  if (!c) return null;
  return {
    reportCardId: c.id,
    student: c.enrollment.student,
    classroom: c.enrollment.classroom.name,
    year: c.enrollment.academicYear.label,
    period: c.period.name,
    school: c.enrollment.school,
    generalAverage: c.generalAverage === null ? null : Number(c.generalAverage),
    rank: c.rank,
    classSize: c.classSize,
    appreciation: c.appreciation,
    lines: c.lines,
    publishedAt: c.publishedAt,
  };
}

export async function signableContent(kind: SignableKind, subjectId: string) {
  switch (kind) {
    case "attestation":
      return attestationContent(subjectId);
    case "certificat":
      return certificateContent(subjectId);
    case "bulletin":
      return bulletinContent(subjectId);
  }
}

export async function signableHash(kind: SignableKind, subjectId: string) {
  const content = await signableContent(kind, subjectId);
  return content ? contentHash(content) : null;
}

// The published report card behind an enrollment and a period, the subject
// of a bulletin signature. Null for a preview.
export async function reportCardIdOf(enrollmentId: string, periodId: string) {
  const card = await db.reportCard.findUnique({ where: { enrollmentId_periodId: { enrollmentId, periodId } }, select: { id: true } });
  return card?.id ?? null;
}
