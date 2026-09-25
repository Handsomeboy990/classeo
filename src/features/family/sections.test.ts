import { describe, expect, it } from "vitest";

import { DEFAULT_ROLES, type RoleCode } from "@/lib/auth/permissions";

import { allowedSections } from "./sections";

const rights = (code: RoleCode) => new Set(DEFAULT_ROLES.find((r) => r.code === code)!.permissions);

describe("allowedSections", () => {
  it("opens every section to a parent", () => {
    expect(allowedSections(rights("PARENT"))).toEqual(["bulletins", "notes", "presences", "emploi-du-temps", "frais"]);
  });

  it("keeps grades, attendance and report cards away from the accountant", () => {
    expect(allowedSections(rights("ACCOUNTANT"))).toEqual(["frais"]);
  });

  it("keeps grades away from the secretary", () => {
    expect(allowedSections(rights("SECRETARY"))).not.toContain("notes");
  });

  it("gives a student no fee section", () => {
    expect(allowedSections(rights("STUDENT"))).not.toContain("frais");
  });
});
