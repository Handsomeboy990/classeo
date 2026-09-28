import { describe, expect, it } from "vitest";

import { DEFAULT_ROLES } from "@/lib/auth/permissions";

import { canSeeSpecialNeeds } from "./needs";

const school = (code: string, schoolId = "ceg") => ({ role: { code }, scope: { level: "SCHOOL", schoolId } });
const current = { schoolId: "ceg" };

describe("canSeeSpecialNeeds (decision D8)", () => {
  it("shows the needs to the head of the student's school and to the teachers of the class", () => {
    expect(canSeeSpecialNeeds(school("SCHOOL_DIRECTOR"), current)).toBe(true);
    // The teacher reaches the enrollment only when teaching or leading the
    // class (enrollmentWhere), so an enrollment in hand means their class.
    expect(canSeeSpecialNeeds(school("TEACHER"), current)).toBe(true);
  });

  it("hides them from every other role", () => {
    const others = DEFAULT_ROLES.map((r) => r.code).filter((c) => c !== "SCHOOL_DIRECTOR" && c !== "TEACHER");
    expect(others.length).toBeGreaterThan(5);
    for (const code of others) {
      expect(canSeeSpecialNeeds(school(code), current), code).toBe(false);
      for (const level of ["NATIONAL", "DEPARTMENT", "COMMUNE", "SELF"]) {
        expect(canSeeSpecialNeeds({ role: { code }, scope: { level, schoolId: null } }, current), `${code} ${level}`).toBe(false);
      }
    }
  });

  it("hides them outside the viewer's school, or without an enrollment of the active year", () => {
    expect(canSeeSpecialNeeds(school("SCHOOL_DIRECTOR", "epp"), current)).toBe(false);
    expect(canSeeSpecialNeeds(school("TEACHER", "epp"), current)).toBe(false);
    expect(canSeeSpecialNeeds(school("SCHOOL_DIRECTOR"), null)).toBe(false);
    expect(canSeeSpecialNeeds(school("TEACHER"), undefined)).toBe(false);
    expect(canSeeSpecialNeeds({ role: { code: "SCHOOL_DIRECTOR" }, scope: { level: "SCHOOL", schoolId: null } }, current)).toBe(false);
  });
});
