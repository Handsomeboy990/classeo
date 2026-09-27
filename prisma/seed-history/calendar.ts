import type { PeriodRef } from "./types";

// The calendars of the past years, built on the pattern of the national
// calendars of 2025-2026 and 2026-2027: school starts on the second Monday
// of September, three terms for the holidays (no break before Christmas, a
// pause at Easter), and the two semesters split at the February pause. The
// exact dates of the orders of those years are to be checked; the shape is
// the national one. Each year is closed by the ministry two weeks after its
// end.
export const PAST_CALENDARS = [
  {
    label: "2022-2023",
    start: "2022-09-12",
    end: "2023-06-23",
    closedAt: "2023-07-07T08:00:00Z",
    trimesters: [
      ["Trimestre 1", "2022-09-12", "2022-12-16"],
      ["Trimestre 2", "2023-01-02", "2023-03-31"],
      ["Trimestre 3", "2023-04-17", "2023-06-23"],
    ],
    semesters: [
      ["Semestre 1", "2022-09-12", "2023-02-17"],
      ["Semestre 2", "2023-02-27", "2023-06-23"],
    ],
  },
  {
    label: "2023-2024",
    start: "2023-09-11",
    end: "2024-06-21",
    closedAt: "2024-07-05T08:00:00Z",
    trimesters: [
      ["Trimestre 1", "2023-09-11", "2023-12-15"],
      ["Trimestre 2", "2024-01-02", "2024-03-28"],
      ["Trimestre 3", "2024-04-15", "2024-06-21"],
    ],
    semesters: [
      ["Semestre 1", "2023-09-11", "2024-02-16"],
      ["Semestre 2", "2024-02-26", "2024-06-21"],
    ],
  },
  {
    label: "2024-2025",
    start: "2024-09-09",
    end: "2025-06-27",
    closedAt: "2025-07-11T08:00:00Z",
    trimesters: [
      ["Trimestre 1", "2024-09-09", "2024-12-20"],
      ["Trimestre 2", "2025-01-06", "2025-04-04"],
      ["Trimestre 3", "2025-04-22", "2025-06-27"],
    ],
    semesters: [
      ["Semestre 1", "2024-09-09", "2025-02-21"],
      ["Semestre 2", "2025-03-03", "2025-06-27"],
    ],
  },
] as const;

// 2025-2026 is closed a week after its end (prisma/seed-extras/governance.ts
// writes the same date).
export const PREV_CLOSED_AT = "2026-07-10T08:00:00Z";

export const DAY = 86_400_000;

export const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

// Week days between two dates, both included.
export function weekDays(from: Date, to: Date) {
  const days: Date[] = [];
  for (let d = from.getTime(); d <= to.getTime(); d += DAY) {
    const wd = new Date(d).getUTCDay();
    if (wd !== 0 && wd !== 6) days.push(new Date(d));
  }
  return days;
}

// School days of a year: the week days inside its terms, so no holiday is
// ever marked.
export function schoolDaysOf(trimesters: PeriodRef[]) {
  return trimesters.flatMap((t) => weekDays(t.startDate, t.endDate));
}

// `count` days spread evenly over the year.
export function spread(days: Date[], count: number, offset = 0) {
  if (days.length <= count) return days;
  const step = days.length / count;
  return Array.from({ length: count }, (_, i) => days[Math.min(days.length - 1, Math.floor(i * step + offset * step))]!);
}

// A time on a school day, 7 h to 16 h in Benin (UTC+1).
export function atWork(d: Date, minutes: number) {
  return new Date(d.getTime() + 6 * 3600_000 + minutes * 60_000);
}
