import { describe, expect, it } from "vitest";

import { DEFAULT_ROLES, PERMISSIONS, type RoleCode } from "@/lib/auth/permissions";

import {
  canAssignRole,
  canAssignRoleOn,
  canEditRoleDetails,
  customRoleCode,
  generateTemporaryPassword,
  isWithinScope,
  planRoleCreate,
  planRoleDeletion,
  planRoleUpdate,
  sameRoleName,
} from "./rights";

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
  it("refuses a role with a permission the actor lacks, at the same level", () => {
    // The teacher role enters grades, which a secretary cannot do.
    expect(canAssignRole(actor("SECRETARY"), role("TEACHER")).ok).toBe(false);
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

describe("planRoleCreate", () => {
  const admin = actor("NATIONAL_ADMIN");
  const director = actor("DEPARTMENT_DIRECTOR");
  it("copies every permission of the source when the actor holds them", () => {
    const r = planRoleCreate({ actor: admin, scopeLevel: "NATIONAL", source: role("NATIONAL_ANALYST").permissions, catalogue });
    expect(r).toEqual({ ok: true, permissions: [...role("NATIONAL_ANALYST").permissions].sort(), dropped: [] });
  });
  it("drops and reports the source permissions the actor does not hold", () => {
    const r = planRoleCreate({ actor: director, scopeLevel: "DEPARTMENT", source: ["school:view", "fee:delete", "audit:export"], catalogue });
    expect(r).toEqual({ ok: true, permissions: ["school:view"], dropped: ["audit:export", "fee:delete"] });
  });
  it("ignores unknown codes and duplicates, and starts empty without a source", () => {
    expect(planRoleCreate({ actor: admin, scopeLevel: "SCHOOL", source: ["school:view", "school:view", "school:fly"], catalogue })).toEqual({
      ok: true,
      permissions: ["school:view"],
      dropped: [],
    });
    expect(planRoleCreate({ actor: admin, scopeLevel: "COMMUNE", catalogue })).toEqual({ ok: true, permissions: [], dropped: [] });
  });
  it("refuses a level above the actor's", () => {
    expect(planRoleCreate({ actor: director, scopeLevel: "NATIONAL", source: ["school:view"], catalogue }).ok).toBe(false);
    expect(planRoleCreate({ actor: director, scopeLevel: "DEPARTMENT", catalogue }).ok).toBe(true);
    expect(planRoleCreate({ actor: director, scopeLevel: "SCHOOL", catalogue }).ok).toBe(true);
  });
  it("refuses a family level role", () => {
    expect(planRoleCreate({ actor: admin, scopeLevel: "SELF", catalogue }).ok).toBe(false);
  });
});

describe("canEditRoleDetails", () => {
  it("allows a custom role at or below the actor's level", () => {
    expect(canEditRoleDetails(actor("DEPARTMENT_DIRECTOR"), { isSystem: false, scopeLevel: "COMMUNE" }).ok).toBe(true);
  });
  it("refuses system roles and roles above the actor", () => {
    expect(canEditRoleDetails(actor("NATIONAL_ADMIN"), { isSystem: true, scopeLevel: "SCHOOL" }).ok).toBe(false);
    expect(canEditRoleDetails(actor("DEPARTMENT_DIRECTOR"), { isSystem: false, scopeLevel: "NATIONAL" }).ok).toBe(false);
  });
});

describe("planRoleDeletion", () => {
  const admin = actor("NATIONAL_ADMIN");
  const custom = { id: "R1", isSystem: false, scopeLevel: "NATIONAL" as const, permissions: ["statistics:view"] };
  const analyst = { id: "R2", scopeLevel: "NATIONAL" as const, permissions: role("NATIONAL_ANALYST").permissions };
  it("deletes an unused custom role without a target", () => {
    expect(planRoleDeletion({ actor: admin, role: custom, holders: { total: 0, inScope: 0 } })).toEqual({ ok: true, move: false });
  });
  it("never deletes a system role", () => {
    expect(planRoleDeletion({ actor: admin, role: { ...custom, isSystem: true }, holders: { total: 0, inScope: 0 } }).ok).toBe(false);
  });
  it("requires a target when accounts use the role, then moves them", () => {
    expect(planRoleDeletion({ actor: admin, role: custom, holders: { total: 2, inScope: 2 } }).ok).toBe(false);
    expect(planRoleDeletion({ actor: admin, role: custom, holders: { total: 2, inScope: 2 }, target: analyst })).toEqual({ ok: true, move: true });
  });
  it("refuses when some holders are outside the actor's scope", () => {
    const r = planRoleDeletion({ actor: admin, role: custom, holders: { total: 3, inScope: 1 }, target: analyst });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toContain("hors de votre périmètre");
    expect(!r.ok && r.reason).not.toMatch(/\d/);
  });
  it("refuses a target of another level, the role itself, or one the actor could not assign", () => {
    const one = { total: 1, inScope: 1 };
    expect(planRoleDeletion({ actor: admin, role: custom, holders: one, target: { ...analyst, scopeLevel: "SCHOOL" } }).ok).toBe(false);
    expect(planRoleDeletion({ actor: admin, role: custom, holders: one, target: { ...custom } }).ok).toBe(false);
    const limited = { permissions: ["role:update", "statistics:view"], scopeLevel: "NATIONAL" as const };
    expect(planRoleDeletion({ actor: limited, role: custom, holders: one, target: analyst }).ok).toBe(false);
  });
  it("refuses a role the actor could not assign", () => {
    const dep = actor("DEPARTMENT_DIRECTOR");
    expect(planRoleDeletion({ actor: dep, role: custom, holders: { total: 0, inScope: 0 } }).ok).toBe(false);
    expect(planRoleDeletion({ actor: dep, role: { ...custom, scopeLevel: "DEPARTMENT", permissions: ["fee:delete"] }, holders: { total: 0, inScope: 0 } }).ok).toBe(false);
  });
});

describe("role names and codes", () => {
  it("treats case, accents and spacing as the same name", () => {
    expect(sameRoleName("Analyste régional", "  analyste   REGIONAL ")).toBe(true);
    expect(sameRoleName("Analyste régional", "Analyste national")).toBe(false);
  });
  it("builds a readable unique code", () => {
    expect(customRoleCode("Analyste régional d'appui", "a1b2c3")).toBe("CUSTOM_ANALYSTE_REGIONAL_D_APPUI_A1B2C3");
    expect(customRoleCode("!!!", "ff00aa")).toBe("CUSTOM_ROLE_FF00AA");
  });
});

describe("isWithinScope and the administrative chains", () => {
  const college = { level: "SCHOOL" as const, departmentId: "D1", communeId: "C1", schoolId: "S1", cycle: "SECONDARY" as const };
  const primary = { level: "SCHOOL" as const, departmentId: "D1", communeId: "C1", schoolId: "S2", cycle: "PRIMARY" as const };
  it("keeps a DDESTFP out of primary schools and a DDEMP out of colleges", () => {
    expect(isWithinScope({ level: "DEPARTMENT", departmentId: "D1", cycles: ["SECONDARY", "TECHNICAL"] }, college)).toBe(true);
    expect(isWithinScope({ level: "DEPARTMENT", departmentId: "D1", cycles: ["SECONDARY", "TECHNICAL"] }, primary)).toBe(false);
    expect(isWithinScope({ level: "DEPARTMENT", departmentId: "D1", cycles: ["PRESCHOOL", "PRIMARY"] }, college)).toBe(false);
  });
  it("keeps a circonscription out of colleges, and a department without a chain on both", () => {
    expect(isWithinScope({ level: "COMMUNE", departmentId: "D1", communeId: "C1", cycles: ["PRESCHOOL", "PRIMARY"] }, college)).toBe(false);
    expect(isWithinScope({ level: "COMMUNE", departmentId: "D1", communeId: "C1", cycles: ["PRESCHOOL", "PRIMARY"] }, primary)).toBe(true);
    expect(isWithinScope({ level: "DEPARTMENT", departmentId: "D1" }, college)).toBe(true);
  });
  it("fails closed on a school of unknown cycle", () => {
    expect(isWithinScope({ level: "DEPARTMENT", departmentId: "D1", cycles: ["SECONDARY"] }, { level: "SCHOOL", departmentId: "D1", schoolId: "S3" })).toBe(false);
  });
});
