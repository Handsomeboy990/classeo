import "server-only";

import { cache } from "react";

import { schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isYearClosed } from "@/lib/guards";
import { param, type SearchParams } from "@/lib/list";

import { yearStatus, type YearStatus } from "./rules";

type User = NonNullable<CurrentUser>;

// The national calendar is public administrative data: every signed in user
// with calendar:view reads all years. Extensions are shown for the schools of
// the reader's scope only (plus the ones granted to every school).
export async function listYears(user: User, now = new Date()) {
  const years = await db.academicYear.findMany({
    orderBy: { startDate: "desc" },
    take: 20,
    select: {
      id: true,
      label: true,
      startDate: true,
      endDate: true,
      isActive: true,
      closedAt: true,
      periods: { orderBy: { order: "asc" }, select: { id: true, name: true, order: true, startDate: true, endDate: true, isClosed: true } },
      extensions: {
        // An empty relation filter on the optional school matches no row, so
        // the ministry (whole country) reads every extension without one.
        where: user.scope.level === "NATIONAL" ? {} : { OR: [{ schoolId: null }, { school: { is: schoolWhere(user) } }] },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, until: true, reason: true, status: true, createdAt: true, requestId: true, school: { select: { id: true, name: true, code: true } } },
      },
      _count: { select: { classrooms: true, enrollments: true } },
    },
  });
  return years.map((y) => {
    const closed = isYearClosed(y, now);
    return {
      ...y,
      closed,
      status: yearStatus(y, closed, now) as YearStatus,
      extensions: y.extensions.map((e) => ({ ...e, running: e.status === "ACTIVE" && e.until >= now })),
    };
  });
}

export type YearOption = { id: string; label: string; status: YearStatus; isActive: boolean };

// Years offered by the year selectors, most recent first.
export const yearOptions = cache(async (now = new Date()): Promise<YearOption[]> => {
  const years = await db.academicYear.findMany({
    orderBy: { startDate: "desc" },
    take: 20,
    select: { id: true, label: true, isActive: true, startDate: true, endDate: true, closedAt: true },
  });
  return years.map((y) => ({ id: y.id, label: y.label, isActive: y.isActive, status: yearStatus(y, isYearClosed(y, now), now) }));
});

// The year a page shows: ?annee=<id> when it exists, otherwise the active
// year, otherwise the most recent one.
export async function selectedYear(sp: SearchParams) {
  const options = await yearOptions();
  const wanted = param(sp, "annee");
  const year = options.find((o) => o.id === wanted) ?? options.find((o) => o.isActive) ?? options[0] ?? null;
  return { year, options };
}

// Whether the user's school can still write in a year, and until when, for
// the notice shown to school staff.
export async function schoolYearAccess(schoolId: string, yearId: string, now = new Date()) {
  const [year, extension] = await Promise.all([
    db.academicYear.findUnique({ where: { id: yearId }, select: { endDate: true, closedAt: true } }),
    db.yearExtension.findFirst({
      where: { academicYearId: yearId, status: "ACTIVE", until: { gte: now }, OR: [{ schoolId: null }, { schoolId }] },
      orderBy: { until: "desc" },
      select: { until: true, schoolId: true },
    }),
  ]);
  if (!year) return null;
  return { closed: isYearClosed(year, now), extendedUntil: extension?.until ?? null, extensionForAll: extension ? extension.schoolId === null : false };
}

// Schools the ministry may grant an extension to, for the picker.
export function extensionSchoolOptions(user: User) {
  return db.school.findMany({
    where: schoolWhere(user),
    orderBy: { name: "asc" },
    take: 2000,
    select: { id: true, name: true, code: true, commune: { select: { name: true } } },
  });
}
