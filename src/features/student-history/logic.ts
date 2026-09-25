// Who reads which part of a pupil's history. Pure, unit tested.
//
// The whole record (every school, every year) is open to the family (the
// guardians and the pupil), the ministry, and a school holding a valid
// record access (granted with a transfer that shares the history, or by the
// school holding the record). A school without that access reads only what
// happened in its own walls; a commune or a department only what happened in
// its territory.

export type HistoryViewer =
  | { kind: "family" }
  | { kind: "national" }
  | { kind: "territory"; schoolIds: Set<string> }
  | { kind: "school"; schoolId: string; access: { expiresAt: Date | null } | null };

export type HistoryReach = { all: true } | { all: false; schoolIds: Set<string> };

export function recordAccessValid(access: { expiresAt: Date | null } | null | undefined, now = new Date()) {
  return !!access && (access.expiresAt === null || access.expiresAt > now);
}

// null: the viewer may not open this history at all. The schools the pupil
// passed through are given (enrollments and transfers).
export function historyReach(viewer: HistoryViewer, pupilSchools: string[], now = new Date()): HistoryReach | null {
  switch (viewer.kind) {
    case "family":
    case "national":
      return { all: true };
    case "school":
      if (recordAccessValid(viewer.access, now)) return { all: true };
      return pupilSchools.includes(viewer.schoolId) ? { all: false, schoolIds: new Set([viewer.schoolId]) } : null;
    case "territory": {
      const inside = pupilSchools.filter((id) => viewer.schoolIds.has(id));
      return inside.length ? { all: false, schoolIds: new Set(inside) } : null;
    }
  }
}

export function reaches(reach: HistoryReach, schoolId: string) {
  return reach.all || reach.schoolIds.has(schoolId);
}

// Until the data model allows two enrollments of a pupil in one school year,
// a school change during the year moves the enrollment to the new school.
// The part of that year spent in the previous school is told apart by the
// date of the accepted transfer: this gives, for a moment in the year, the
// school the pupil attended then.
export type YearMove = { at: Date; fromSchoolId: string; toSchoolId: string };

export function schoolAt(currentSchoolId: string, moves: YearMove[], at: Date) {
  // Moves sorted oldest first; the school at a date is the origin of the
  // first move that happened after it.
  const later = [...moves].sort((a, b) => a.at.getTime() - b.at.getTime()).find((m) => m.at > at);
  return later ? later.fromSchoolId : currentSchoolId;
}
