// Teacher file: the page of a person of the national registry, for the
// accounts above school level. Pure functions, unit tested; file.ts runs the
// queries.

type Level = "NATIONAL" | "DEPARTMENT" | "COMMUNE" | "SCHOOL" | "SELF";

// A school keeps its own record of each appointment (/espace/enseignants/
// [id]); the file of the person, with every school, is for the ministry,
// the departments and the circonscriptions.
export const FILE_LEVELS: readonly Level[] = ["NATIONAL", "DEPARTMENT", "COMMUNE"];

export type AppointmentScope = { id: string; isActive: boolean; inScope: boolean };

export type FileAccess = { allowed: false } | { allowed: true; visibleIds: string[]; hiddenActive: number };

// Who opens the file of a person, and which of their appointments they see.
// - The viewer holds teacher:view and works above school level.
// - The person teaches, or taught, in at least one school of the viewer's
//   territory and chain (inScope comes from schoolWhere, the scope filter
//   of every query).
// - Only those appointments are shown. An active appointment elsewhere
//   counts, without a name: the viewer knows the person also works outside
//   their territory, never where. A past one elsewhere is left out.
// - The ministry also opens the agents of the State it recorded and who are
//   not appointed anywhere yet, as its registry lists them.
export function teacherFileAccess(input: { level: Level; canView: boolean; stateAgent?: boolean; appointments: AppointmentScope[] }): FileAccess {
  if (!input.canView || !FILE_LEVELS.includes(input.level)) return { allowed: false };
  const visible = input.appointments.filter((a) => a.inScope);
  const unappointedAgent = input.level === "NATIONAL" && !!input.stateAgent && !input.appointments.some((a) => a.isActive);
  if (!visible.length && !unappointedAgent) return { allowed: false };
  return {
    allowed: true,
    visibleIds: visible.map((a) => a.id),
    hiddenActive: input.appointments.filter((a) => !a.inScope && a.isActive).length,
  };
}

export type YearRef = { id: string; label: string; startDate: Date; isActive: boolean };

// One course (or one class led as main teacher) of the person in a school.
export type CourseLine = {
  year: YearRef;
  schoolId: string;
  schoolName: string;
  classroom: string;
  subject: string | null;
  weeklyHours: number;
  main?: boolean;
};

export type YearSummary = {
  year: YearRef;
  hours: number;
  schools: { schoolId: string; schoolName: string; classes: string[]; subjects: string[]; mainClasses: string[]; hours: number }[];
};

// The person's courses grouped by school year (latest first), then by
// school (alphabetical). Classes and subjects keep the order given, without
// repeats; a class led as main teacher without a course still shows.
export function historyByYear(lines: CourseLine[]): YearSummary[] {
  const years = new Map<string, YearSummary>();
  for (const l of lines) {
    let y = years.get(l.year.id);
    if (!y) years.set(l.year.id, (y = { year: l.year, hours: 0, schools: [] }));
    let s = y.schools.find((x) => x.schoolId === l.schoolId);
    if (!s) y.schools.push((s = { schoolId: l.schoolId, schoolName: l.schoolName, classes: [], subjects: [], mainClasses: [], hours: 0 }));
    if (!s.classes.includes(l.classroom)) s.classes.push(l.classroom);
    if (l.main) {
      if (!s.mainClasses.includes(l.classroom)) s.mainClasses.push(l.classroom);
    } else {
      if (l.subject && !s.subjects.includes(l.subject)) s.subjects.push(l.subject);
      s.hours += l.weeklyHours;
      y.hours += l.weeklyHours;
    }
  }
  const out = [...years.values()].sort((a, b) => b.year.startDate.getTime() - a.year.startDate.getTime());
  for (const y of out) y.schools.sort((a, b) => a.schoolName.localeCompare(b.schoolName, "fr"));
  return out;
}

// Grade sheets of the year: opened, with at least one mark, locked.
export function sheetProgress(sheets: { isLocked: boolean; grades: number }[]) {
  return {
    total: sheets.length,
    filled: sheets.filter((s) => s.grades > 0).length,
    locked: sheets.filter((s) => s.isLocked).length,
  };
}

// Days of the week covered by timetable slots, "lundi, mardi et jeudi".
const DAYS = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
export function weekDays(days: number[]) {
  const names = [...new Set(days)]
    .filter((d) => d >= 1 && d <= 7)
    .sort((a, b) => a - b)
    .map((d) => DAYS[d]!);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} et ${names.at(-1)}`;
}
