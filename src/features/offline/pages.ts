import "server-only";

import { getActiveYear, getCurrentPeriod, userPeriodicity } from "@/features/classes/academic";
import { classroomOptions } from "@/features/classes/queries";
import { followedEnrollments } from "@/features/family/queries";
import { allowedSections } from "@/features/family/sections";
import { sheetWriteWhere } from "@/features/grades/queries";
import { can } from "@/lib/auth/authorize";
import type { CurrentUser } from "@/lib/auth/session";
import { todayIso } from "@/lib/domain/attendance";
import { db } from "@/lib/db";

type User = NonNullable<CurrentUser>;

// Upper bound of pages kept per account; the service worker also stops at
// a size budget (public/sw.js).
export const MAX_OFFLINE_PAGES = 40;

// The pages a user needs without network, even if never opened on this
// device, in order of importance: the service worker downloads them in the
// background after sign in. Every address is one the user can open: the
// pages still check rights and scope when they are rendered.
export async function offlinePages(user: User): Promise<string[]> {
  const pages: string[] = ["/espace", "/espace/aide", "/espace/preferences"];
  const add = (...urls: string[]) => pages.push(...urls);
  if (can(user, "message:view")) add("/espace/messages");
  add("/espace/notifications");

  if (user.scope.level === "SELF") {
    if (can(user, "student:view") || can(user, "report_card:view")) add("/espace/suivi");
    const sections = allowedSections(user.permissions).filter((s) => s !== "frais");
    for (const e of await followedEnrollments(user)) {
      // The student file opens on the report cards.
      if (sections.includes("bulletins")) add(`/espace/suivi/${e.studentId}`);
      for (const s of sections) if (s !== "bulletins") add(`/espace/suivi/${e.studentId}/${s}`);
    }
  } else if (user.scope.level === "SCHOOL") {
    const teacher = user.role.code === "TEACHER";
    const classes = can(user, "class:view") || can(user, "attendance:view") ? await classroomOptions(user) : [];
    if (can(user, "class:view")) add("/espace/classes");
    if (teacher && can(user, "class:view")) add(...classes.map((c) => `/espace/classes/${c.id}`));
    if (can(user, "student:view") && !teacher) add("/espace/eleves");

    if (can(user, "grade:view")) {
      add("/espace/notes");
      const [year, period] = await Promise.all([getActiveYear(), getCurrentPeriod(userPeriodicity(user))]);
      if (teacher && year && period && can(user, "grade:update")) {
        const sheets = await db.gradeSheet.findMany({
          where: { AND: [sheetWriteWhere(user), { periodId: period.id, assignment: { classroom: { academicYearId: year.id } } }] },
          select: { id: true },
          orderBy: { assignment: { classroom: { name: "asc" } } },
          take: 20,
        });
        add(...sheets.map((s) => `/espace/notes/${s.id}`));
      }
    }

    if (can(user, "attendance:view")) {
      add("/espace/presences");
      // Today's registers, both halves, with the address the filter form
      // builds (classe, date, demi), so it matches when the user picks one.
      if (teacher) {
        const today = todayIso();
        for (const c of classes) for (const half of ["MORNING", "AFTERNOON"]) add(`/espace/presences?classe=${c.id}&date=${today}&demi=${half}`);
      }
    }
    if (can(user, "timetable:view")) add("/espace/emploi-du-temps");
  }

  return [...new Set(pages)].slice(0, MAX_OFFLINE_PAGES);
}
