// Attendance rules transposed from the scolarite project (AttendanceService.php).
// Pure functions, no database access, fully unit tested.

export type AttendanceStatusCode = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export const ATTENDANCE_STATUSES: AttendanceStatusCode[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

export const ATTENDANCE_LABELS: Record<AttendanceStatusCode, string> = {
  PRESENT: "Présent",
  ABSENT: "Absent",
  LATE: "En retard",
  EXCUSED: "Excusé",
};

export type StatusCounts = Partial<Record<AttendanceStatusCode, number>>;

// Attendance rate as in AttendanceService::getStats: records marked present
// over all records. A late student came to class, so a lateness counts as a
// presence; an excused absence is still an absence. No record at all means
// nothing to report, so the rate is null rather than a flattering 100 %.
export function attendanceRate(counts: StatusCounts): number | null {
  const total = ATTENDANCE_STATUSES.reduce((acc, s) => acc + (counts[s] ?? 0), 0);
  if (!total) return null;
  const attended = (counts.PRESENT ?? 0) + (counts.LATE ?? 0);
  return Math.round((attended / total) * 10000) / 10000;
}

export function countStatuses(statuses: AttendanceStatusCode[]): StatusCounts {
  const counts: StatusCounts = {};
  for (const s of statuses) counts[s] = (counts[s] ?? 0) + 1;
  return counts;
}

// A new absence is one that was not already recorded as such: saving the
// same register twice must not alert the family twice.
export function newAbsences<T extends { enrollmentId: string; status: AttendanceStatusCode }>(
  next: T[],
  previous: Map<string, AttendanceStatusCode>,
): T[] {
  return next.filter((r) => r.status === "ABSENT" && previous.get(r.enrollmentId) !== "ABSENT");
}

// ---------------------------------------------------------------------------
// Calendar dates. Attendance dates are calendar days in Benin (UTC+1, no
// daylight saving). They travel as "YYYY-MM-DD" strings and are stored in a
// DATE column, which Prisma maps to midnight UTC.
// ---------------------------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function todayIso(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Porto-Novo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function isoToDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function dateToIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = isoToDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return dateToIso(d);
}

// Monday to Friday of the school week containing the date.
export function schoolWeek(iso: string): { from: string; to: string } {
  const day = isoToDate(iso).getUTCDay(); // 0 = Sunday
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  const from = addDays(iso, offsetToMonday);
  return { from, to: addDays(from, 4) };
}

export function isWeekend(iso: string): boolean {
  const day = isoToDate(iso).getUTCDay();
  return day === 0 || day === 6;
}
