import "server-only";

import { classPreview, printableCard, type CardLine } from "@/features/report-cards/queries";
import { enrollmentWhere } from "@/lib/auth/scope";
import { db } from "@/lib/db";
import { round2 } from "@/lib/domain/grades";

import type { ReportCardData } from "../documents/report-card";
import type { PdfUser } from "../respond";

import { schoolIssuer, validId } from "./common";

async function publishedClassAverage(classroomId: string, periodId: string) {
  const agg = await db.reportCard.aggregate({ where: { periodId, enrollment: { classroomId } }, _avg: { generalAverage: true } });
  const v = agg._avg.generalAverage;
  return v === null ? null : round2(Number(v));
}

// One report card, reached either by enrollment and period or by the id of
// a published card (family space). printableCard() applies the scope: a
// family sees only the published cards of its own children.
export async function loadReportCard(user: PdfUser, key: { enrollmentId: string; periodId: string } | { reportCardId: string }) {
  let enrollmentId: string;
  let periodId: string;
  if ("reportCardId" in key) {
    if (!validId(key.reportCardId)) return null;
    const found = await db.reportCard.findFirst({
      where: { id: key.reportCardId, enrollment: enrollmentWhere(user) },
      select: { enrollmentId: true, periodId: true },
    });
    if (!found) return null;
    ({ enrollmentId, periodId } = found);
  } else {
    if (!validId(key.enrollmentId) || !validId(key.periodId)) return null;
    ({ enrollmentId, periodId } = key);
  }
  const printable = await printableCard(user, enrollmentId, periodId);
  if (!printable || !printable.card) return null;
  const { enrollment, period, mode, card } = printable;
  const school = await db.school.findFirst({
    where: { classrooms: { some: { id: enrollment.classroomId } } },
    select: { id: true, email: true },
  });
  const classAverage = await publishedClassAverage(enrollment.classroomId, period.id);
  const mt = enrollment.classroom.mainTeacher;
  const data: ReportCardData = {
    enrollmentId: enrollment.id,
    mode,
    student: enrollment.student,
    classroom: { name: enrollment.classroom.name, mainTeacher: mt ? `${mt.firstName} ${mt.lastName}` : null },
    headOfSchool: await headOfSchool(school?.id),
    isRepeating: enrollment.isRepeating,
    yearLabel: enrollment.academicYear.label,
    periodName: period.name,
    card: { ...card, lines: card.lines as CardLine[] },
    classAverage: mode === "published" ? classAverage : undefined,
  };
  return {
    data,
    periodId: period.id,
    schoolId: school?.id ?? null,
    issuer: schoolIssuer({ ...enrollment.classroom.school, email: school?.email ?? null }),
  };
}

// Name of the active head of a school, shown in the signature block.
export async function headOfClassroomSchool(classroomId: string) {
  const classroom = await db.classroom.findUnique({ where: { id: classroomId }, select: { schoolId: true } });
  return headOfSchool(classroom?.schoolId);
}

async function headOfSchool(schoolId: string | null | undefined) {
  if (!schoolId) return null;
  const head = await db.user.findFirst({
    where: { schoolId, isActive: true, role: { code: "SCHOOL_DIRECTOR" } },
    orderBy: { createdAt: "asc" },
    select: { firstName: true, lastName: true },
  });
  return head ? `${head.firstName} ${head.lastName}` : null;
}

// Every report card of a class for a period, for staff who may export them.
// Published students print their published snapshot; the others print the
// live computation, marked as a preview.
export async function loadClassReportCards(user: PdfUser, classroomId: string, periodId: string) {
  if (!validId(classroomId) || !validId(periodId)) return null;
  const preview = await classPreview(user, classroomId, periodId);
  if (!preview) return null;
  const period = await db.schoolPeriod.findFirst({ where: { id: periodId, academicYearId: preview.classroom.academicYearId }, select: { id: true, name: true } });
  if (!period) return null;

  const [classroom, enrollments, snapshots] = await Promise.all([
    db.classroom.findUniqueOrThrow({
      where: { id: preview.classroom.id },
      select: {
        id: true,
        name: true,
        academicYear: { select: { label: true } },
        mainTeacher: { select: { firstName: true, lastName: true } },
        school: { select: { id: true, name: true, code: true, address: true, phone: true, email: true, commune: { select: { name: true, department: { select: { name: true } } } } } },
      },
    }),
    db.enrollment.findMany({
      where: { classroomId: preview.classroom.id, status: "ACTIVE" },
      select: { id: true, isRepeating: true, student: { select: { matricule: true, firstName: true, lastName: true, gender: true, birthDate: true, birthPlace: true } } },
    }),
    db.reportCard.findMany({
      where: { periodId: period.id, enrollment: { classroomId: preview.classroom.id } },
      include: { publishedBy: { select: { firstName: true, lastName: true } } },
    }),
  ]);
  const byEnrollment = new Map(enrollments.map((e) => [e.id, e]));
  const snapshotOf = new Map(snapshots.map((s) => [s.enrollmentId, s]));
  const mt = classroom.mainTeacher ? `${classroom.mainTeacher.firstName} ${classroom.mainTeacher.lastName}` : null;
  const publishedAverage = snapshots.length ? await publishedClassAverage(classroom.id, period.id) : null;
  const head = await headOfSchool(classroom.school.id);

  // Alphabetical order, the order of the class list.
  const cards = [...preview.cards].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const items: ReportCardData[] = [];
  for (const c of cards) {
    const e = byEnrollment.get(c.enrollmentId);
    if (!e) continue;
    const snap = snapshotOf.get(c.enrollmentId);
    items.push({
      enrollmentId: e.id,
      mode: snap ? "published" : "preview",
      student: e.student,
      classroom: { name: classroom.name, mainTeacher: mt },
      headOfSchool: head,
      isRepeating: e.isRepeating,
      yearLabel: classroom.academicYear.label,
      periodName: period.name,
      card: snap
        ? {
            generalAverage: snap.generalAverage === null ? null : Number(snap.generalAverage),
            rank: snap.rank,
            classSize: snap.classSize,
            appreciation: snap.appreciation,
            lines: snap.lines as CardLine[],
            publishedAt: snap.publishedAt,
            publishedBy: `${snap.publishedBy.firstName} ${snap.publishedBy.lastName}`,
          }
        : { generalAverage: c.generalAverage, rank: c.rank, classSize: preview.cards.length, appreciation: c.appreciation, lines: c.lines, publishedAt: null, publishedBy: null },
      classAverage: snap ? publishedAverage : preview.summary.classAverage,
    });
  }
  return { classroom, period, items, issuer: schoolIssuer(classroom.school) };
}
