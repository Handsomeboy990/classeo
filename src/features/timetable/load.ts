import "server-only";

import { can } from "@/lib/auth/authorize";
import type { CurrentUser } from "@/lib/auth/session";
import { addDays, isoDay, weekMonday } from "@/lib/domain/timetable";
import { param, type SearchParams } from "@/lib/list";

import { getClassTimetable, getTeacherTimetable, getTimetableClasses, isTeacherView, type SlotView } from "./queries";

type User = NonNullable<CurrentUser>;

function today() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export type TimetableData = {
  mode: "teacher" | "class" | "unavailable";
  yearLabel: string | null;
  monday: Date;
  todayIso: string;
  day: number;
  classes: { id: string; name: string }[];
  selected: { id: string; name: string } | null;
  slots: SlotView[];
  assignments: { id: string; label: string }[];
  rights: { create: boolean; update: boolean; delete: boolean };
};

// Reads the URL (class, week, day) and loads the matching week, scoped to
// the user. A class id outside the user's scope is ignored, never loaded.
export async function loadTimetable(user: User, sp: SearchParams): Promise<TimetableData> {
  const now = today();
  const week = param(sp, "semaine");
  const ref = week && /^\d{4}-\d{2}-\d{2}$/.test(week) && !Number.isNaN(new Date(`${week}T00:00:00Z`).getTime()) ? new Date(`${week}T00:00:00Z`) : now;
  const monday = weekMonday(ref);
  const requestedDay = Number(param(sp, "jour"));
  const inThisWeek = now >= monday && now < addDays(monday, 7);
  const day = requestedDay >= 1 && requestedDay <= 6 ? requestedDay : inThisWeek && isoDay(now) <= 6 ? isoDay(now) : 1;
  const base = { monday, todayIso: now.toISOString().slice(0, 10), day };

  if (isTeacherView(user)) {
    const { year, slots } = await getTeacherTimetable(user, monday);
    return {
      ...base,
      mode: "teacher",
      yearLabel: year?.label ?? null,
      classes: [],
      selected: null,
      slots,
      assignments: [],
      rights: { create: false, update: false, delete: false },
    };
  }

  const rights = { create: can(user, "timetable:create"), update: can(user, "timetable:update"), delete: can(user, "timetable:delete") };
  if (user.scope.level !== "SCHOOL" && user.scope.level !== "SELF")
    return { ...base, mode: "unavailable", yearLabel: null, classes: [], selected: null, slots: [], assignments: [], rights };

  const { year, classes } = await getTimetableClasses(user);
  const selected = classes.find((c) => c.id === param(sp, "classe")) ?? classes[0] ?? null;
  const { slots, assignments } = selected ? await getClassTimetable(selected.id, monday) : { slots: [], assignments: [] };
  return { ...base, mode: "class", yearLabel: year?.label ?? null, classes, selected, slots, assignments, rights };
}
