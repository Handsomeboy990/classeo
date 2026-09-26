import { describe, expect, it } from "vitest";

import { decisionError, proposedDecision } from "./council";

describe("class council proposals", () => {
  it("proposes passage at 10/20 and repetition below in secondary (articles 60 and 62)", () => {
    expect(proposedDecision({ levelCode: "4E", primary: false, yearlyAverage: 10 })).toBe("PROMOTED");
    expect(proposedDecision({ levelCode: "4E", primary: false, yearlyAverage: 9.99 })).toBe("REPEAT");
    expect(proposedDecision({ levelCode: "4E", primary: false, yearlyAverage: null })).toBeNull();
  });

  it("never proposes an exclusion", () => {
    expect(proposedDecision({ levelCode: "2NDE", primary: false, yearlyAverage: 4 })).toBe("REPEAT");
  });

  it("moves primary pupils up at the start of a sub-cycle whatever the average", () => {
    expect(proposedDecision({ levelCode: "CI", primary: true, yearlyAverage: 6 })).toBe("PROMOTED");
    expect(proposedDecision({ levelCode: "CE1", primary: true, yearlyAverage: null })).toBe("PROMOTED");
    expect(proposedDecision({ levelCode: "CE2", primary: true, yearlyAverage: 8 })).toBe("REPEAT");
  });

  it("asks for the reason of an exclusion", () => {
    expect(decisionError({ decision: "EXCLUDED", note: null })).toMatch(/Motivez/);
    expect(decisionError({ decision: "EXCLUDED", note: "Abandon de plus de 60 jours" })).toBeNull();
    expect(decisionError({ decision: "REPEAT", note: null })).toBeNull();
  });
});
