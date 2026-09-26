import { describe, expect, it } from "vitest";

import { chainOfCycle, cycleInScope, ministryName, scopeCycles, supervisionOf } from "./chains";

describe("administrative chains", () => {
  it("puts nursery and primary schools under the MEMP, secondary ones under the MESTFP", () => {
    expect(chainOfCycle("PRESCHOOL")).toBe("PRIMARY");
    expect(chainOfCycle("PRIMARY")).toBe("PRIMARY");
    expect(chainOfCycle("SECONDARY")).toBe("SECONDARY");
    expect(chainOfCycle("TECHNICAL")).toBe("SECONDARY");
    expect(ministryName("PRIMARY")).toBe("Ministère des Enseignements Maternel et Primaire");
    expect(ministryName("SECONDARY")).toBe("Ministère des Enseignements Secondaire, Technique et de la Formation Professionnelle");
    expect(ministryName(null)).toBe("Ministères en charge de l'éducation");
  });

  it("limits a circonscription to nursery and primary schools, and a direction to its chain", () => {
    expect(scopeCycles("COMMUNE", null)).toEqual(["PRESCHOOL", "PRIMARY"]);
    expect(scopeCycles("COMMUNE", "SECONDARY")).toEqual(["PRESCHOOL", "PRIMARY"]);
    expect(scopeCycles("DEPARTMENT", "SECONDARY")).toEqual(["SECONDARY", "TECHNICAL"]);
    expect(scopeCycles("DEPARTMENT", "PRIMARY")).toEqual(["PRESCHOOL", "PRIMARY"]);
    // An account without a chain keeps both, as before the chains existed.
    expect(scopeCycles("DEPARTMENT", null)).toBeNull();
    expect(scopeCycles("NATIONAL", null)).toBeNull();
    expect(scopeCycles("SCHOOL", "PRIMARY")).toBeNull();
  });

  it("fails closed on a school of unknown cycle for a limited scope", () => {
    expect(cycleInScope(null, undefined)).toBe(true);
    expect(cycleInScope(["SECONDARY", "TECHNICAL"], "SECONDARY")).toBe(true);
    expect(cycleInScope(["SECONDARY", "TECHNICAL"], "PRIMARY")).toBe(false);
    expect(cycleInScope(["PRESCHOOL", "PRIMARY"], null)).toBe(false);
  });

  it("describes the supervision of a school, without circonscription for a college", () => {
    expect(supervisionOf({ cycle: "SECONDARY", departmentName: "Atlantique", communeName: "Abomey-Calavi" })).toMatchObject({
      ministry: { short: "MESTFP" },
      direction: "DDESTFP Atlantique",
      circonscription: null,
    });
    expect(supervisionOf({ cycle: "PRIMARY", departmentName: "Atlantique", communeName: "Abomey-Calavi" })).toMatchObject({
      ministry: { short: "MEMP" },
      direction: "DDEMP Atlantique",
      circonscription: "Circonscription scolaire d'Abomey-Calavi",
    });
  });
});
