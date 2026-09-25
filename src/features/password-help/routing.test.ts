import { describe, expect, it } from "vitest";

import { DEFAULT_ROLES, type RoleCode } from "@/lib/auth/permissions";

import { canHandleHelp, helpRouteLevel } from "./routing";

const account = (code: RoleCode) => {
  const r = DEFAULT_ROLES.find((x) => x.code === code)!;
  return { scopeLevel: r.scopeLevel, permissions: r.permissions };
};

describe("helpRouteLevel", () => {
  it("sends families and school staff to the school head", () => {
    expect(helpRouteLevel({ scopeLevel: "SELF", managesUsers: false })).toBe("SCHOOL");
    expect(helpRouteLevel({ scopeLevel: "SCHOOL", managesUsers: false })).toBe("SCHOOL");
  });
  it("sends each manager one level up", () => {
    expect(helpRouteLevel({ scopeLevel: "SCHOOL", managesUsers: true })).toBe("COMMUNE");
    expect(helpRouteLevel({ scopeLevel: "COMMUNE", managesUsers: true })).toBe("DEPARTMENT");
    expect(helpRouteLevel({ scopeLevel: "DEPARTMENT", managesUsers: true })).toBe("NATIONAL");
  });
});

describe("canHandleHelp", () => {
  it("lets a school head help a teacher, a secretary, a parent and a pupil", () => {
    for (const code of ["TEACHER", "SECRETARY", "PARENT", "STUDENT"] as const) expect(canHandleHelp(account("SCHOOL_DIRECTOR"), account(code)).ok).toBe(true);
  });
  it("sends a school head to the communal district, not to a peer", () => {
    expect(canHandleHelp(account("COMMUNE_INSPECTOR"), account("SCHOOL_DIRECTOR")).ok).toBe(true);
    expect(canHandleHelp(account("SCHOOL_DIRECTOR"), account("SCHOOL_DIRECTOR")).ok).toBe(false);
  });
  it("follows the chain upward", () => {
    expect(canHandleHelp(account("DEPARTMENT_DIRECTOR"), account("COMMUNE_INSPECTOR")).ok).toBe(true);
    expect(canHandleHelp(account("NATIONAL_ADMIN"), account("DEPARTMENT_DIRECTOR")).ok).toBe(true);
    // A department does not skip the commune for a school head.
    expect(canHandleHelp(account("DEPARTMENT_DIRECTOR"), account("SCHOOL_DIRECTOR")).ok).toBe(false);
  });
  it("refuses a handler without user:update", () => {
    expect(canHandleHelp(account("SECRETARY"), account("PARENT")).ok).toBe(false);
    expect(canHandleHelp(account("NATIONAL_ANALYST"), account("DEPARTMENT_DIRECTOR")).ok).toBe(false);
  });
  it("applies the anti escalation rule between national peers", () => {
    expect(canHandleHelp(account("NATIONAL_ADMIN"), account("NATIONAL_ANALYST")).ok).toBe(true);
    const limited = { scopeLevel: "NATIONAL" as const, permissions: ["user:update", "user:view"] };
    expect(canHandleHelp(limited, account("NATIONAL_ADMIN")).ok).toBe(false);
  });
});
