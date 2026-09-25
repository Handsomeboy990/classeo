import { describe, expect, it } from "vitest";

import { DEFAULT_ROLES, PERMISSIONS, type RoleCode } from "@/lib/auth/permissions";

import { canAssignRole, canAssignRoleOn, generateTemporaryPassword, isWithinScope, planRoleUpdate } from "./rights";

const role = (code: RoleCode) => DEFAULT_ROLES.find((r) => r.code === code)!;
const actor = (code: RoleCode) => ({ permissions: role(code).permissions, scopeLevel: role(code).scopeLevel });
const catalogue = PERMISSIONS.map((p) => p.code);

describe("isWithinScope", () => {
  const dep = { level: "DEPARTMENT" as const, departmentId: "D1" };
  it("lets a national actor reach anything", () => {
    expect(isWithinScope({ level: "NATIONAL" }, { level: "SCHOOL", departmentId: "D9", communeId: "C9", schoolId: "S9" })).toBe(true);
  });
  it("keeps a departmental actor inside their department", () => {
    expect(isWithinScope(dep, { level: "COMMUNE", departmentId: "D1", communeId: "C1" })).toBe(true);
    expect(isWithinScope(dep, { level: "SCHOOL", departmentId: "D2", communeId: "C2", schoolId: "S2" })).toBe(false);
  });
  it("refuses a level above the actor, even without ids", () => {
    expect(isWithinScope(dep, { level: "NATIONAL" })).toBe(false);
    expect(isWithinScope({ level: "SCHOOL", schoolId: "S1" }, { level: "COMMUNE", communeId: "C1" })).toBe(false);
  });
  it("fails closed on an incomplete scope", () => {
    expect(isWithinScope({ level: "DEPARTMENT", departmentId: null }, { level: "COMMUNE", departmentId: null, communeId: "C1" })).toBe(false);
    expect(isWithinScope({ level: "SELF" }, { level: "SELF" })).toBe(false);
  });
});

describe("canAssignRole", () => {
  it("refuses a school director creating a national administrator", () => {
    const r = canAssignRole(actor("SCHOOL_DIRECTOR"), role("NATIONAL_ADMIN"));
    expect(r.ok).toBe(false);
  });
  it("refuses a role with a permission the actor lacks, even at a lower level", () => {
    // The teacher role enters grades, which a school director only views.
    expect(canAssignRole(actor("SCHOOL_DIRECTOR"), role("TEACHER")).ok).toBe(false);
  });
  it("accepts a subset role at or below the actor's level", () => {
    expect(canAssignRole(actor("SCHOOL_DIRECTOR"), role("SECRETARY")).ok).toBe(true);
    expect(canAssignRole(actor("NATIONAL_ADMIN"), role("NATIONAL_ADMIN")).ok).toBe(true);
  });
  it("refuses a subset role whose level is above the actor's", () => {
    const partnerLike = { permissions: ["statistics:view"], scopeLevel: "NATIONAL" as const };
    expect(canAssignRole(actor("DEPARTMENT_DIRECTOR"), partnerLike).ok).toBe(false);
  });
});

describe("canAssignRoleOn", () => {
  const director = { ...actor("SCHOOL_DIRECTOR"), scope: { level: "SCHOOL" as const, departmentId: "D1", communeId: "C1", schoolId: "S1" } };
  it("accepts the actor's own school", () => {
    expect(canAssignRoleOn(director, role("SECRETARY"), { level: "SCHOOL", departmentId: "D1", communeId: "C1", schoolId: "S1" }).ok).toBe(true);
  });
  it("refuses another school", () => {
    expect(canAssignRoleOn(director, role("SECRETARY"), { level: "SCHOOL", departmentId: "D1", communeId: "C1", schoolId: "S2" }).ok).toBe(false);
  });
  it("refuses an entity whose level does not match the role", () => {
    const admin = { ...actor("NATIONAL_ADMIN"), scope: { level: "NATIONAL" as const } };
    expect(canAssignRoleOn(admin, role("DEPARTMENT_DIRECTOR"), { level: "COMMUNE", departmentId: "D1", communeId: "C1" }).ok).toBe(false);
    expect(canAssignRoleOn(admin, role("DEPARTMENT_DIRECTOR"), { level: "DEPARTMENT", departmentId: "D1" }).ok).toBe(true);
  });
});

describe("planRoleUpdate", () => {
  const admin = actor("NATIONAL_ADMIN");
  it("computes added and removed permissions", () => {
    const r = planRoleUpdate({
      actor: admin,
      role: { code: "SECRETARY", scopeLevel: "SCHOOL" },
      current: ["school:view", "class:view"],
      submitted: ["school:view", "grade:view"],
      catalogue,
    });
    expect(r).toEqual({ ok: true, added: ["grade:view"], removed: ["class:view"], next: ["grade:view", "school:view"] });
  });
  it("refuses granting a permission the actor does not hold", () => {
    const limited = { permissions: ["role:view", "role:update", "school:view"], scopeLevel: "NATIONAL" as const };
    const r = planRoleUpdate({ actor: limited, role: { code: "SECRETARY", scopeLevel: "SCHOOL" }, current: [], submitted: ["user:create"], catalogue });
    expect(r.ok).toBe(false);
  });
  it("keeps permissions the actor does not hold instead of removing them", () => {
    const limited = { permissions: ["role:view", "role:update", "school:view"], scopeLevel: "NATIONAL" as const };
    const r = planRoleUpdate({ actor: limited, role: { code: "SECRETARY", scopeLevel: "SCHOOL" }, current: ["user:create", "school:view"], submitted: [], catalogue });
    expect(r).toEqual({ ok: true, added: [], removed: ["school:view"], next: ["user:create"] });
  });
  it("protects the national administrator against a lockout", () => {
    const current = role("NATIONAL_ADMIN").permissions;
    const r = planRoleUpdate({
      actor: admin,
      role: { code: "NATIONAL_ADMIN", scopeLevel: "NATIONAL" },
      current,
      submitted: current.filter((p) => p !== "role:update"),
      catalogue,
    });
    expect(r.ok).toBe(false);
    const other = planRoleUpdate({
      actor: admin,
      role: { code: "NATIONAL_ADMIN", scopeLevel: "NATIONAL" },
      current,
      submitted: current.filter((p) => p !== "fee:delete"),
      catalogue,
    });
    expect(other.ok && other.removed).toEqual(["fee:delete"]);
  });
  it("refuses unknown permission codes and roles above the actor", () => {
    expect(planRoleUpdate({ actor: admin, role: { code: "SECRETARY", scopeLevel: "SCHOOL" }, current: [], submitted: ["school:fly"], catalogue }).ok).toBe(false);
    const dep = { permissions: ["role:update", "role:view"], scopeLevel: "DEPARTMENT" as const };
    expect(planRoleUpdate({ actor: dep, role: { code: "NATIONAL_ANALYST", scopeLevel: "NATIONAL" }, current: [], submitted: [], catalogue }).ok).toBe(false);
  });
});

describe("generateTemporaryPassword", () => {
  it("meets the password policy", () => {
    for (let i = 0; i < 200; i++) {
      const p = generateTemporaryPassword();
      expect(p).toHaveLength(12);
      expect(p).toMatch(/[A-Za-z]/);
      expect(p).toMatch(/[0-9]/);
      expect(p).not.toMatch(/[0O1lI]/);
    }
  });
  it("never goes below ten characters", () => {
    expect(generateTemporaryPassword(4)).toHaveLength(10);
  });
});
