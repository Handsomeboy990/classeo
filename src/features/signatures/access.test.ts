import { describe, expect, it } from "vitest";

import { DEFAULT_ROLES, type PermissionCode } from "@/lib/auth/permissions";

import { canSignSchoolDocuments, signerKind } from "./access";

function userOf(code: string, schoolId: string | null = "s1") {
  const role = DEFAULT_ROLES.find((r) => r.code === code)!;
  return { permissions: new Set<PermissionCode>(role.permissions), scope: { level: role.scopeLevel, schoolId: role.scopeLevel === "SCHOOL" ? schoolId : null } };
}

describe("signerKind", () => {
  it("makes the school head the signer of school documents", () => {
    expect(signerKind(userOf("SCHOOL_DIRECTOR"))).toBe("school");
    expect(canSignSchoolDocuments(userOf("SCHOOL_DIRECTOR"))).toBe(true);
  });

  it("refuses the other school accounts", () => {
    for (const code of ["SECRETARY", "ACCOUNTANT", "TEACHER"]) expect(signerKind(userOf(code))).toBeNull();
  });

  it("refuses a head account without a school", () => {
    expect(signerKind(userOf("SCHOOL_DIRECTOR", null))).toBeNull();
  });

  it("lets territorial officials keep a signature, not sign school documents", () => {
    for (const code of ["COMMUNE_INSPECTOR", "DEPARTMENT_DIRECTOR", "NATIONAL_ADMIN"]) {
      expect(signerKind(userOf(code))).toBe("territory");
      expect(canSignSchoolDocuments(userOf(code))).toBe(false);
    }
  });

  it("refuses families, analysts and partners", () => {
    for (const code of ["PARENT", "STUDENT", "NATIONAL_ANALYST", "PARTNER"]) expect(signerKind(userOf(code))).toBeNull();
  });
});
