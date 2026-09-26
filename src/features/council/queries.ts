import "server-only";

import { rosterClassroomWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { proposedDecision } from "@/lib/domain/council";
import { yearlyAverage } from "@/lib/domain/periodicity";
import { sortByName } from "@/lib/utils";

type User = NonNullable<CurrentUser>;

// The class council sheet: every active pupil with the yearly average of
// their published report cards (article 59), the proposal of the rules and
// the decision already recorded.
export async function classCouncil(user: User, classroomId: string) {
  if (classroomId.length > 64) return null;
  const classroom = await db.classroom.findFirst({
    where: { AND: [{ id: classroomId }, rosterClassroomWhere(user)] },
    select: {
      id: true,
      name: true,
      schoolId: true,
      academicYearId: true,
      academicYear: { select: { label: true } },
      level: { select: { code: true, cycle: true } },
      school: { select: { name: true, periodicity: true } },
      enrollments: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          student: { select: { id: true, firstName: true, lastName: true, matricule: true } },
          reportCards: { select: { generalAverage: true, period: { select: { periodicity: true, order: true } } } },
          councilDecision: { select: { decision: true, note: true, decidedAt: true } },
        },
      },
    },
  });
  if (!classroom) return null;
  const primary = classroom.level.cycle === "PRIMARY" || classroom.level.cycle === "PRESCHOOL";
  const pupils = sortByName(classroom.enrollments, (e) => e.student).map((e) => {
    const average = yearlyAverage(
      e.reportCards
        .filter((c) => c.period.periodicity === classroom.school.periodicity)
        .map((c) => ({ periodicity: c.period.periodicity, order: c.period.order, average: c.generalAverage === null ? null : Number(c.generalAverage) })),
    );
    return {
      enrollmentId: e.id,
      student: e.student,
      reportCards: e.reportCards.length,
      yearlyAverage: average,
      proposal: proposedDecision({ levelCode: classroom.level.code, primary, yearlyAverage: average }),
      decision: e.councilDecision,
    };
  });
  return { classroom, pupils };
}
