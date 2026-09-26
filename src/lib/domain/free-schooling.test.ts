import { describe, expect, it } from "vitest";

import { feeCreationError, feeExemption, isFreeSchooling } from "./free-schooling";

const publicCollege = { sector: "PUBLIC", cycle: "SECONDARY" } as const;
const y2026 = new Date("2026-09-14T00:00:00Z");
const y2025 = new Date("2025-09-22T00:00:00Z");

describe("free public nursery and primary schools", () => {
  it("forbids any fee in a public nursery or primary school", () => {
    expect(isFreeSchooling({ sector: "PUBLIC", cycle: "PRIMARY" })).toBe(true);
    expect(isFreeSchooling({ sector: "PUBLIC", cycle: "PRESCHOOL" })).toBe(true);
    expect(feeCreationError({ sector: "PUBLIC", cycle: "PRIMARY" })).toMatch(/gratuits depuis 2006/);
  });

  it("lets private schools and public colleges bill", () => {
    expect(feeCreationError({ sector: "PRIVATE", cycle: "PRIMARY" })).toBeNull();
    expect(feeCreationError({ sector: "CONFESSIONAL", cycle: "PRIMARY" })).toBeNull();
    expect(feeCreationError(publicCollege)).toBeNull();
  });
});

describe("girls exempt from the contribution scolaire (order of 30 July 2026)", () => {
  it("exempts girls of public general secondary schools from 2026-2027", () => {
    expect(feeExemption({ kind: "SCHOOL_CONTRIBUTION", school: publicCollege, gender: "F", yearStart: y2026 })).toBe("Exonérée (arrêté du 30 juillet 2026)");
  });

  it("does not exempt boys, other fees, earlier years or other schools", () => {
    expect(feeExemption({ kind: "SCHOOL_CONTRIBUTION", school: publicCollege, gender: "M", yearStart: y2026 })).toBeNull();
    expect(feeExemption({ kind: "APE_DUES", school: publicCollege, gender: "F", yearStart: y2026 })).toBeNull();
    expect(feeExemption({ kind: "SCHOOL_CONTRIBUTION", school: publicCollege, gender: "F", yearStart: y2025 })).toBeNull();
    expect(feeExemption({ kind: "SCHOOL_CONTRIBUTION", school: { sector: "PRIVATE", cycle: "SECONDARY" }, gender: "F", yearStart: y2026 })).toBeNull();
    expect(feeExemption({ kind: "SCHOOL_CONTRIBUTION", school: { sector: "PUBLIC", cycle: "TECHNICAL" }, gender: "F", yearStart: y2026 })).toBeNull();
  });
});
