import "server-only";

import { can } from "@/lib/auth/authorize";
import { enrollmentWhere, rosterClassroomWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { computeClassCards } from "./compute";
import { fillLineTeachers } from "./lines";

type User = NonNullable<CurrentUser>;

export type CardLine = { subject: string; coefficient: number; average: number | null; rank: number | null; teacher?: string | null };

// Subject name to the teacher currently assigned in a class.
export async function currentTeachers(classroomId: string) {
  const rows = await db.courseAssignment.findMany({
    where: { classroomId, teacherId: { not: null } },
    select: { subject: { select: { name: true } }, teacher: { select: { firstName: true, lastName: true } } },
  });
  return new Map(rows.map((r) => [r.subject.name, `${r.teacher!.firstName} ${r.teacher!.lastName}`]));
}

// Lines of a published snapshot, each with its teacher: the one recorded at
// publication, otherwise the one currently assigned in the class.
export async function snapshotLines(classroomId: string, lines: unknown, teachers?: ReadonlyMap<string, string>) {
  const list = lines as CardLine[];
  if (list.every((l) => l.teacher)) return list;
  return fillLineTeachers(list, teachers ?? (await currentTeachers(classroomId)));
}

// Classes of the year with, for one period, how many report cards are
// published out of the active students.
export async function publicationOverview(user: User, yearId: string, periodId: string) {
  const classes = await db.classroom.findMany({
    where: { AND: [rosterClassroomWhere(user), { academicYearId: yearId }] },
    orderBy: [{ level: { order: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
    },
    take: 500,
  });
  const published = await db.reportCard.groupBy({
    by: ["enrollmentId"],
    where: { periodId, enrollment: { classroomId: { in: classes.map((c) => c.id) }, status: "ACTIVE" } },
  });
  const enrollmentClass = new Map(
    (
      await db.enrollment.findMany({ where: { id: { in: published.map((p) => p.enrollmentId) } }, select: { id: true, classroomId: true } })
    ).map((e) => [e.id, e.classroomId]),
  );
  const perClass = new Map<string, number>();
  for (const p of published) {
    const c = enrollmentClass.get(p.enrollmentId);
    if (c) perClass.set(c, (perClass.get(c) ?? 0) + 1);
  }
  return classes.map((c) => ({ id: c.id, name: c.name, students: c._count.enrollments, published: perClass.get(c.id) ?? 0 }));
}

export async function classPreview(user: User, classroomId: string, periodId: string) {
  const classroom = await db.classroom.findFirst({
    where: { AND: [{ id: classroomId }, rosterClassroomWhere(user)] },
    select: { id: true, name: true, academicYearId: true },
  });
  if (!classroom) return null;
  const [computed, published] = await Promise.all([
    computeClassCards(classroom.id, periodId),
    db.reportCard.findMany({
      where: { periodId, enrollment: { classroomId: classroom.id } },
      select: { enrollmentId: true, publishedAt: true, generalAverage: true, rank: true },
    }),
  ]);
  return { classroom, ...computed, published: new Map(published.map((p) => [p.enrollmentId, p])) };
}

// One report card for the printable page: the published snapshot when there
// is one; otherwise, for staff allowed to publish, a live preview.
export async function printableCard(user: User, enrollmentId: string, periodId: string) {
  const enrollment = await db.enrollment.findFirst({
    where: { AND: [{ id: enrollmentId }, enrollmentWhere(user)] },
    select: {
      id: true,
      classroomId: true,
      academicYearId: true,
      isRepeating: true,
      student: { select: { id: true, matricule: true, firstName: true, lastName: true, gender: true, birthDate: true, birthPlace: true, photoFileId: true } },
      classroom: {
        select: {
          name: true,
          level: { select: { name: true } },
          mainTeacher: { select: { firstName: true, lastName: true } },
          school: { select: { name: true, code: true, address: true, phone: true, commune: { select: { name: true, department: { select: { name: true } } } } } },
        },
      },
      academicYear: { select: { label: true } },
    },
  });
  if (!enrollment) return null;
  const period = await db.schoolPeriod.findFirst({ where: { id: periodId, academicYearId: enrollment.academicYearId } });
  if (!period) return null;

  const snapshot = await db.reportCard.findUnique({
    where: { enrollmentId_periodId: { enrollmentId: enrollment.id, periodId: period.id } },
    include: { publishedBy: { select: { firstName: true, lastName: true } } },
  });
  if (snapshot) {
    return {
      enrollment,
      period,
      mode: "published" as const,
      card: {
        generalAverage: snapshot.generalAverage === null ? null : Number(snapshot.generalAverage),
        rank: snapshot.rank,
        classSize: snapshot.classSize,
        appreciation: snapshot.appreciation,
        lines: await snapshotLines(enrollment.classroomId, snapshot.lines),
        publishedAt: snapshot.publishedAt,
        publishedBy: `${snapshot.publishedBy.firstName} ${snapshot.publishedBy.lastName}`,
      },
    };
  }
  if (!can(user, "report_card:publish") || user.scope.level === "SELF") return { enrollment, period, mode: "none" as const, card: null };
  const computed = await computeClassCards(enrollment.classroomId, period.id);
  const card = computed.cards.find((c) => c.enrollmentId === enrollment.id);
  if (!card) return { enrollment, period, mode: "none" as const, card: null };
  return {
    enrollment,
    period,
    mode: "preview" as const,
    card: {
      generalAverage: card.generalAverage,
      rank: card.rank,
      classSize: computed.cards.length,
      appreciation: card.appreciation,
      lines: card.lines as CardLine[],
      publishedAt: null,
      publishedBy: null,
    },
  };
}
