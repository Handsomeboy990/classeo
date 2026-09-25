// Pure rules of the family space: school calendar in Benin time, attendance
// summaries, timetable grid and the sentences Kora speaks. No database access,
// unit tested in logic.test.ts.

import { mention } from "@/lib/domain/grades";
import { formatAverage } from "@/lib/utils";

// Benin is on West Africa Time, UTC+1 all year, no daylight saving.
const BENIN_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 86_400_000;

export const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;

export type SchoolDay = {
  // Local calendar date, "2026-09-25".
  iso: string;
  // 1 = Monday ... 7 = Sunday, as TimetableSlot.dayOfWeek.
  dayOfWeek: number;
};

export function beninToday(now: Date = new Date()): SchoolDay {
  const local = new Date(now.getTime() + BENIN_OFFSET_MS);
  const iso = local.toISOString().slice(0, 10);
  const js = local.getUTCDay();
  return { iso, dayOfWeek: js === 0 ? 7 : js };
}

// Monday 00:00 to Sunday 00:00 of the week containing the day, as UTC
// midnights, the way @db.Date columns come back from the database.
export function weekRange(day: SchoolDay): { start: Date; end: Date } {
  const today = new Date(`${day.iso}T00:00:00.000Z`);
  const start = new Date(today.getTime() - (day.dayOfWeek - 1) * DAY_MS);
  return { start, end: new Date(start.getTime() + 7 * DAY_MS) };
}

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
export type AttendanceRecord = { date: Date; half: "MORNING" | "AFTERNOON"; status: AttendanceStatus; reason: string | null };

export type AttendanceSummary = { absences: number; lates: number; excused: number; recorded: number };

export function summariseAttendance(records: AttendanceRecord[]): AttendanceSummary {
  return {
    absences: records.filter((r) => r.status === "ABSENT").length,
    lates: records.filter((r) => r.status === "LATE").length,
    excused: records.filter((r) => r.status === "EXCUSED").length,
    recorded: records.length,
  };
}

// "Présent" rate over the half days recorded; excused absences count as
// neither present nor absent.
export function presenceRate(summary: AttendanceSummary): number | null {
  const counted = summary.recorded - summary.excused;
  if (counted <= 0) return null;
  return (counted - summary.absences) / counted;
}

// "Aucune absence", "Une absence", "3 absences"; masculine nouns pass "m".
export function countWord(n: number, one: string, many: string, gender: "f" | "m" = "f") {
  if (n === 0) return `${gender === "f" ? "Aucune" : "Aucun"} ${one}`;
  if (n === 1) return `${gender === "f" ? "Une" : "Un"} ${one}`;
  return `${n} ${many}`;
}

export type SlotLike = { dayOfWeek: number; startTime: string; endTime: string };

export function sortSlots<T extends SlotLike>(slots: T[]): T[] {
  return [...slots].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
}

// Weekly grid: one row per distinct time band, one column per school day that
// has at least one slot (Monday to Friday always shown).
export function timetableGrid<T extends SlotLike>(slots: T[]) {
  const bands = [...new Map(slots.map((s) => [`${s.startTime}-${s.endTime}`, { start: s.startTime, end: s.endTime }])).values()].sort((a, b) =>
    a.start.localeCompare(b.start),
  );
  const lastDay = Math.max(5, ...slots.map((s) => s.dayOfWeek));
  const days = Array.from({ length: lastDay }, (_, i) => i + 1);
  const cell = (day: number, start: string, end: string) => slots.find((s) => s.dayOfWeek === day && s.startTime === start && s.endTime === end) ?? null;
  return { bands, days, cell };
}

// "07:00" -> "7 h", "09:15" -> "9 h 15": the way times are spoken in French.
export function spokenTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

export type SummaryInput = {
  firstName: string;
  classroom: string;
  lastReport: { average: number | null; periodLabel: string } | null;
  weekAbsences: number;
  todayCourses: { subject: string; startTime: string }[];
  isWeekend?: boolean;
};

function averageWords(average: number | null) {
  const m = mention(average);
  if (!m || average === null) return "pas encore de moyenne";
  return `${formatAverage(average)} sur 20, ${m.label}`;
}

// The spoken summary of a child, short sentences, the essentials first.
export function spokenSummary(input: SummaryInput): string {
  const parts = [`${input.firstName}, classe de ${input.classroom}.`];
  if (input.lastReport) parts.push(`Dernier bulletin, ${input.lastReport.periodLabel} : ${averageWords(input.lastReport.average)}.`);
  else parts.push("Pas encore de bulletin publié.");
  parts.push(`${countWord(input.weekAbsences, "absence", "absences")} cette semaine.`);
  if (input.isWeekend) parts.push("Pas de cours aujourd'hui.");
  else if (input.todayCourses.length) {
    const first = input.todayCourses[0]!;
    parts.push(
      `Aujourd'hui, ${input.todayCourses.length} cours. Le premier : ${first.subject} à ${spokenTime(first.startTime)}.`,
    );
  }
  return parts.join(" ");
}

export function reportSentence(r: { firstName: string; periodLabel: string; average: number | null; rank: number | null; classSize: number; appreciation: string | null }) {
  const parts = [`Bulletin de ${r.firstName}, ${r.periodLabel}. Moyenne générale : ${averageWords(r.average)}.`];
  if (r.rank) parts.push(`Rang : ${rankLabel(r.rank, r.classSize)}.`);
  if (r.appreciation) parts.push(`Appréciation : ${r.appreciation}`);
  return parts.join(" ");
}

export function rankLabel(rank: number | null, size?: number) {
  if (!rank) return "–";
  const ord = `${rank}${rank === 1 ? "er" : "e"}`;
  return size ? `${ord} sur ${size}` : ord;
}

export type ReportLine = { subject: string; coefficient: number; average: number | null; rank: number | null };

// Report card lines are stored as JSON: parse defensively, never trust shape.
export function parseReportLines(raw: unknown): ReportLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((l) => {
    if (!l || typeof l !== "object") return [];
    const o = l as Record<string, unknown>;
    if (typeof o.subject !== "string") return [];
    return [
      {
        subject: o.subject,
        coefficient: typeof o.coefficient === "number" ? o.coefficient : 1,
        average: typeof o.average === "number" ? o.average : null,
        rank: typeof o.rank === "number" ? o.rank : null,
      },
    ];
  });
}

export const INVOICE_STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" | "info" }> = {
  PAID: { label: "Payé", tone: "success" },
  PARTIALLY_PAID: { label: "Payé en partie", tone: "warning" },
  PENDING: { label: "À payer", tone: "info" },
  OVERDUE: { label: "En retard", tone: "danger" },
  CANCELLED: { label: "Annulé", tone: "neutral" },
};

export const ATTENDANCE_STATUS: Record<AttendanceStatus, { label: string; tone: "success" | "warning" | "danger" | "info" }> = {
  PRESENT: { label: "Présent", tone: "success" },
  ABSENT: { label: "Absent", tone: "danger" },
  LATE: { label: "En retard", tone: "warning" },
  EXCUSED: { label: "Excusé", tone: "info" },
};
