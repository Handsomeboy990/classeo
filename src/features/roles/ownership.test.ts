import { describe, expect, it } from "vitest";

import { canManageRole, canReceiveHolders, creatableLevels, isNationalRole, ownerFor, roleFitsTarget, type ActorScope } from "./ownership";

const national = { ownerSchoolId: null, ownerCommuneId: null, ownerDepartmentId: null };
const ofSchool = (id: string) => ({ ...national, ownerSchoolId: id });
const ofCommune = (id: string) => ({ ...national, ownerCommuneId: id });

const minister: ActorScope = { level: "NATIONAL", departmentId: null, communeId: null, schoolId: null };
const head: ActorScope = { level: "SCHOOL", departmentId: "D1", communeId: "C1", schoolId: "S1" };
const inspector: ActorScope = { level: "COMMUNE", departmentId: "D1", communeId: "C1", schoolId: null };
const parent: ActorScope = { level: "SELF", departmentId: null, communeId: null, schoolId: null };

describe("ownerFor", () => {
  it("gives no owner to the national level and its own entity to the others", () => {
    expect(ownerFor(minister)).toEqual(national);
    expect(ownerFor(head)).toEqual(ofSchool("S1"));
    expect(ownerFor(inspector)).toEqual(ofCommune("C1"));
    expect(ownerFor({ level: "DEPARTMENT", departmentId: "D1", communeId: null, schoolId: null })).toEqual({ ...national, ownerDepartmentId: "D1" });
  });
  it("refuses family accounts and incomplete scopes", () => {
    expect(ownerFor(parent)).toBeNull();
    expect(ownerFor({ ...head, schoolId: null })).toBeNull();
  });
});

describe("creatableLevels", () => {
  it("keeps an entity at its own level", () => {
    expect(creatableLevels(head)).toEqual(["SCHOOL"]);
    expect(creatableLevels(inspector)).toEqual(["COMMUNE"]);
    expect(creatableLevels(parent)).toEqual([]);
    expect(creatableLevels(minister)).toContain("SCHOOL");
  });
});

describe("canManageRole", () => {
  it("lets the ministry change every role", () => {
    expect(canManageRole(minister, national).ok).toBe(true);
    expect(canManageRole(minister, ofSchool("S9")).ok).toBe(true);
  });
  it("shows national roles read only to a school head", () => {
    const r = canManageRole(head, national);
    expect(r.ok).toBe(false);
    expect(isNationalRole(national)).toBe(true);
  });
  it("lets a school head change the roles of their school only", () => {
    expect(canManageRole(head, ofSchool("S1")).ok).toBe(true);
    expect(canManageRole(head, ofSchool("S2")).ok).toBe(false);
    // A commune role is not a school's, even inside the commune.
    expect(canManageRole(head, ofCommune("C1")).ok).toBe(false);
    expect(canManageRole(inspector, ofSchool("S1")).ok).toBe(false);
  });
});

describe("roleFitsTarget", () => {
  it("keeps a school's role inside that school", () => {
    expect(roleFitsTarget(ofSchool("S1"), { level: "SCHOOL", schoolId: "S1", communeId: "C1", departmentId: "D1" }).ok).toBe(true);
    expect(roleFitsTarget(ofSchool("S1"), { level: "SCHOOL", schoolId: "S2", communeId: "C1", departmentId: "D1" }).ok).toBe(false);
    expect(roleFitsTarget(ofCommune("C1"), { level: "COMMUNE", communeId: "C2", departmentId: "D1" }).ok).toBe(false);
    expect(roleFitsTarget(national, { level: "SCHOOL", schoolId: "S7" }).ok).toBe(true);
  });
});

describe("canReceiveHolders", () => {
  it("accepts a national role or one of the same owner", () => {
    expect(canReceiveHolders(ofSchool("S1"), national).ok).toBe(true);
    expect(canReceiveHolders(ofSchool("S1"), ofSchool("S1")).ok).toBe(true);
    expect(canReceiveHolders(ofSchool("S1"), ofSchool("S2")).ok).toBe(false);
  });
});
