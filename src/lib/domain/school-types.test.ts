import { describe, expect, it } from "vitest";

import { fundingOf, schoolTypeError, schoolTypeLabel } from "./school-types";

const SECTORS = { PUBLIC: "Public", PRIVATE: "Privé laïc", CONFESSIONAL: "Privé confessionnel", COMMUNITY: "Communautaire" } as const;

describe("funding", () => {
  it("follows the sector and the cycle", () => {
    expect(fundingOf({ sector: "PUBLIC", cycle: "PRIMARY" })).toBe("STATE_FREE");
    expect(fundingOf({ sector: "PUBLIC", cycle: "PRESCHOOL" })).toBe("STATE_FREE");
    expect(fundingOf({ sector: "PUBLIC", cycle: "SECONDARY" })).toBe("STATE_CONTRIBUTION");
    expect(fundingOf({ sector: "PRIVATE", cycle: "PRIMARY" })).toBe("PRIVATE_FEES");
    expect(fundingOf({ sector: "CONFESSIONAL", cycle: "SECONDARY" })).toBe("PRIVATE_FEES");
    expect(fundingOf({ sector: "COMMUNITY", cycle: "PRIMARY" })).toBe("COMMUNITY");
  });
});

describe("school type", () => {
  it("describes a confessional or bilingual school", () => {
    expect(schoolTypeLabel({ sector: "CONFESSIONAL", denomination: "FRANCO_ARABIC" }, SECTORS)).toBe("Privé confessionnel, franco-arabe");
    expect(schoolTypeLabel({ sector: "PRIVATE", isBilingual: true }, SECTORS)).toBe("Privé laïc, bilingue");
    expect(schoolTypeLabel({ sector: "PUBLIC", denomination: "CATHOLIC" }, SECTORS)).toBe("Public");
  });

  it("keeps faith and authorisation for the schools they concern", () => {
    expect(schoolTypeError({ sector: "PRIVATE", denomination: "CATHOLIC", authorizationRef: null, promoter: null })).toMatch(/confessionnel/);
    expect(schoolTypeError({ sector: "PUBLIC", denomination: null, authorizationRef: "Arrêté 12", promoter: null })).toMatch(/non publics/);
    expect(schoolTypeError({ sector: "CONFESSIONAL", denomination: "PROTESTANT", authorizationRef: "Arrêté 12", promoter: "Église méthodiste" })).toBeNull();
  });
});
