// Who may read a student's special needs or disability (owner's decision
// D8). Sensitive data about a minor: it never appears in a list or a table
// next to the names, and on the student's record only for the head of the
// student's school and the teachers of the student's class. Every other
// role (secretary, accountant, territorial and national staff, partners,
// families) never receives it. Pure, unit tested.

type Viewer = {
  role: { code: string };
  scope: { level: string; schoolId?: string | null };
};

// `current` is the student's enrollment of the active year as the viewer
// reaches it: it must come from a query filtered by enrollmentWhere(user),
// which limits a teacher to the classes they teach or lead. Without such an
// enrollment, nobody sees the needs.
export function canSeeSpecialNeeds(user: Viewer, current: { schoolId: string } | null | undefined): boolean {
  if (!current || user.scope.level !== "SCHOOL" || !user.scope.schoolId) return false;
  if (current.schoolId !== user.scope.schoolId) return false;
  return user.role.code === "SCHOOL_DIRECTOR" || user.role.code === "TEACHER";
}
