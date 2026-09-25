import "server-only";

import type { CurrentUser } from "@/lib/auth/session";

import { spokenSummary, summariseAttendance, type SchoolDay } from "./logic";
import { lastReportCard, termGrades, timetableOf, weekAttendance, type FamilyEnrollment } from "./queries";

type User = NonNullable<CurrentUser>;

// Everything the dashboard and the student file header say about one child.
export async function childOverview(user: User, enrollment: FamilyEnrollment, today: SchoolDay) {
  const [lastReport, week, slots, term] = await Promise.all([
    lastReportCard(user, enrollment.student.id),
    weekAttendance(enrollment, today),
    timetableOf(enrollment),
    termGrades(enrollment, today),
  ]);
  const todaySlots = slots.filter((s) => s.dayOfWeek === today.dayOfWeek);
  const weekSummary = summariseAttendance(week);
  const summary = spokenSummary({
    firstName: enrollment.student.firstName,
    classroom: enrollment.classroom.name,
    lastReport,
    weekAbsences: weekSummary.absences,
    todayCourses: todaySlots,
    isWeekend: today.dayOfWeek >= 6,
  });
  return { enrollment, lastReport, weekSummary, hasTimetable: slots.length > 0, todaySlots, term, summary };
}

export type ChildOverview = Awaited<ReturnType<typeof childOverview>>;
