// Report card lines: the teacher of each subject. A published snapshot keeps
// the teacher of the day; older snapshots have none, and then the teacher
// currently assigned to the subject in the class is shown instead.

export type TeacherLine = { subject: string; teacher?: string | null };

export function fillLineTeachers<L extends TeacherLine>(lines: L[], currentTeachers: ReadonlyMap<string, string>): L[] {
  return lines.map((l) => (l.teacher ? l : { ...l, teacher: currentTeachers.get(l.subject) ?? null }));
}

// The teacher column is worth showing only when at least one row names one.
export function hasTeacherColumn(lines: TeacherLine[]) {
  return lines.some((l) => Boolean(l.teacher));
}
