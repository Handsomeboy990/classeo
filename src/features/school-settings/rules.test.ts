import { describe, expect, it } from "vitest";

import { groupByFour, normalizeBankAccount, normalizeMobileNumber, normalizeWebsite } from "./rules";

describe("normalizeMobileNumber", () => {
  it("accepts ten digit Benin numbers, with or without the country code", () => {
    expect(normalizeMobileNumber("01 97 12 34 56")).toBe("+229 01 97 12 34 56");
    expect(normalizeMobileNumber("+229 0197123456")).toBe("+229 01 97 12 34 56");
    expect(normalizeMobileNumber("00229-01-97-12-34-56")).toBe("+229 01 97 12 34 56");
  });
  it("completes an old eight digit number", () => {
    expect(normalizeMobileNumber("97123456")).toBe("+229 01 97 12 34 56");
  });
  it("refuses anything else", () => {
    for (const bad of ["", "12345", "02 97 12 34 56", "+33 6 12 34 56 78", "abc"]) expect(normalizeMobileNumber(bad)).toBeNull();
  });
});

describe("normalizeBankAccount", () => {
  it("accepts an IBAN and a RIB", () => {
    expect(normalizeBankAccount("bj66 bj01 0010 0100 1234 5678 9012")).toBe("BJ66BJ0100100100123456789012");
    expect(normalizeBankAccount("B0061 01001 123456789")).toBe("B006101001123456789");
  });
  it("refuses a malformed account", () => {
    expect(normalizeBankAccount("BJ12")).toBeNull();
    expect(normalizeBankAccount("BJ66BJ01001001001234567890")).toBeNull();
    expect(normalizeBankAccount("<script>alert(1)</script>")).toBeNull();
  });
  it("groups by four for reading", () => {
    expect(groupByFour("BJ66BJ0100")).toBe("BJ66 BJ01 00");
  });
});

describe("normalizeWebsite", () => {
  it("keeps web addresses only", () => {
    expect(normalizeWebsite("ceg-godomey.bj")).toBe("https://ceg-godomey.bj");
    expect(normalizeWebsite("http://ecole.example.org/")).toBe("http://ecole.example.org");
    expect(normalizeWebsite("javascript:alert(1)")).toBeNull();
    expect(normalizeWebsite("localhost")).toBeNull();
  });
});
