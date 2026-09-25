import { describe, expect, it } from "vitest";

import { roleLabel } from "./role-label";

describe("roleLabel", () => {
  it("uses the feminine form for a woman", () => {
    expect(roleLabel("Enseignant", "F")).toBe("Enseignante");
    expect(roleLabel("Directeur départemental", "F")).toBe("Directrice départementale");
  });

  it("keeps the role name for a man or an unknown gender", () => {
    expect(roleLabel("Enseignant", "M")).toBe("Enseignant");
    expect(roleLabel("Enseignant", null)).toBe("Enseignant");
  });

  it("keeps a custom role name as written", () => {
    expect(roleLabel("Conseiller pédagogique", "F")).toBe("Conseiller pédagogique");
  });
});
