import { describe, expect, it } from "vitest";

import { DEFAULT_ROLES, type PermissionCode, type RoleCode } from "@/lib/auth/permissions";
import { mobileTabs, tabAudience, visibleNavigation } from "@/lib/navigation";

// The phone tab bar comes from the permission filtered menu: each kind of
// user gets its four most used destinations, never an entry it cannot open.

function userOf(code: RoleCode, extra: { guardianId?: string; studentId?: string; teacherId?: string } = {}) {
  const role = DEFAULT_ROLES.find((r) => r.code === code)!;
  return {
    permissions: new Set<PermissionCode>(role.permissions),
    scope: { level: role.scopeLevel },
    guardianId: extra.guardianId ?? null,
    studentId: extra.studentId ?? null,
    teacherId: extra.teacherId ?? null,
  };
}

function tabs(user: ReturnType<typeof userOf>) {
  return mobileTabs(visibleNavigation(user), tabAudience(user)).map((i) => i.short ?? i.label);
}

describe("mobile tabs", () => {
  it("gives a parent their children, messages and announcements", () => {
    expect(tabs(userOf("PARENT", { guardianId: "g" }))).toEqual(["Accueil", "Mes enfants", "Messages", "Annonces"]);
  });

  it("gives a student their schooling first", () => {
    expect(tabs(userOf("STUDENT", { studentId: "s" }))[1]).toBe("Ma scolarité");
  });

  it("gives a teacher grades, attendance and messages", () => {
    expect(tabs(userOf("TEACHER", { teacherId: "t" }))).toEqual(["Accueil", "Notes", "Présences", "Messages"]);
  });

  it("gives a school director students, grades and fees", () => {
    expect(tabs(userOf("SCHOOL_DIRECTOR"))).toEqual(["Accueil", "Élèves", "Notes", "Frais"]);
  });

  it("gives the ministry the territory, statistics and requests", () => {
    expect(tabs(userOf("NATIONAL_ADMIN"))).toEqual(["Accueil", "Territoire", "Statistiques", "Demandes"]);
  });

  it("only ever picks entries of the user's own menu", () => {
    for (const role of DEFAULT_ROLES) {
      const user = userOf(role.code, { guardianId: "g", studentId: "s" });
      const visible = new Set(visibleNavigation(user).flatMap((s) => s.items.map((i) => i.href)));
      for (const tab of mobileTabs(visibleNavigation(user), tabAudience(user))) expect(visible.has(tab.href)).toBe(true);
    }
  });
});
