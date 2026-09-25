import "server-only";

import { computeReportCards, summarizeClass, type SheetInput } from "@/lib/domain/report-card";
import type { GradeInput } from "@/lib/domain/grades";
import { db } from "@/lib/db";
import { sortByName } from "@/lib/utils";

// Loads the grades of a class for a period and computes every report card.
// The caller has already checked that the class is in the user's scope.
export async function computeClassCards(classroomId: string, periodId: string) {
  const [enrollments, assignments] = await Promise.all([
    db.enrollment
      .findMany({
        where: { classroomId, status: "ACTIVE" },
        orderBy: { id: "asc" },
        select: { id: true, student: { select: { id: true, matricule: true, firstName: true, lastName: true, gender: true, userId: true } } },
      })
      // French alphabetical order, whatever the database collation.
      .then((rows) => sortByName(rows, (e) => e.student)),
    db.courseAssignment.findMany({
      where: { classroomId },
      orderBy: [{ coefficient: "desc" }, { subject: { name: "asc" } }],
      select: {
        id: true,
        coefficient: true,
        subject: { select: { name: true } },
        teacher: { select: { firstName: true, lastName: true } },
        gradeSheets: {
          where: { periodId },
          select: {
            id: true,
            formula: true,
            isLocked: true,
            grades: { select: { enrollmentId: true, type: true, value: true, maxValue: true } },
          },
        },
      },
    }),
  ]);

  const sheets: SheetInput[] = assignments.map((a) => {
    const sheet = a.gradeSheets[0];
    const grades = new Map<string, GradeInput[]>();
    for (const g of sheet?.grades ?? []) {
      const list = grades.get(g.enrollmentId) ?? [];
      list.push({ type: g.type, value: Number(g.value), maxValue: Number(g.maxValue) });
      grades.set(g.enrollmentId, list);
    }
    return {
      subject: a.subject.name,
      coefficient: a.coefficient,
      teacher: a.teacher ? `${a.teacher.firstName} ${a.teacher.lastName}` : null,
      formula: sheet?.formula ?? "WEIGHTED_STANDARD",
      grades,
    };
  });

  const cards = computeReportCards(
    enrollments.map((e) => ({ enrollmentId: e.id, name: `${e.student.lastName} ${e.student.firstName}` })),
    sheets,
  );
  const students = new Map(enrollments.map((e) => [e.id, e.student]));
  const missingSheets = assignments.filter((a) => !a.gradeSheets.length).map((a) => a.subject.name);
  const unlockedSheets = assignments.filter((a) => a.gradeSheets[0] && !a.gradeSheets[0].isLocked).map((a) => a.subject.name);

  return {
    cards: cards.map((c) => ({ ...c, student: students.get(c.enrollmentId)! })),
    subjects: sheets.map((s) => ({ subject: s.subject, coefficient: s.coefficient, teacher: s.teacher })),
    summary: summarizeClass(cards.map((c) => c.generalAverage)),
    missingSheets,
    unlockedSheets,
  };
}
