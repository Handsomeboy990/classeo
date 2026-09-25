import { describe, expect, it } from "vitest";

import { foldName, maskPhone, parseRegistryQuery, phoneKey, SQL_ACCENTS_FROM, SQL_ACCENTS_TO } from "./registry-rules";

describe("foldName", () => {
  it("ignores accents, case and spacing", () => {
    expect(foldName("  Sènami   HOUNKPATIN ")).toBe("senami hounkpatin");
    expect(foldName("Bénédicta Zannou")).toBe(foldName("benedicta zannou"));
  });
});

describe("SQL accent folding", () => {
  it("maps each accented letter to one plain letter, as foldName does", () => {
    expect([...SQL_ACCENTS_FROM].length).toBe([...SQL_ACCENTS_TO].length);
    [...SQL_ACCENTS_FROM].forEach((c, i) => {
      if (c !== "ɛ" && c !== "ɔ") expect(foldName(c)).toBe([...SQL_ACCENTS_TO][i]);
    });
  });
});

describe("phoneKey", () => {
  it("matches an old 8 digit number with its new 10 digit form", () => {
    expect(phoneKey("97 45 12 30")).toBe(phoneKey("01 97 45 12 30"));
    expect(phoneKey("+229 0197451230")).toBe("97451230");
    expect(phoneKey("1234")).toBeNull();
  });
});

describe("parseRegistryQuery", () => {
  it("reads 10 digits as an NPI and a phone number", () => {
    expect(parseRegistryQuery("2000000123")).toEqual({ npi: "2000000123", phone: "00000123", names: [] });
  });
  it("reads a shorter number as a phone number only", () => {
    expect(parseRegistryQuery("97 45 12 30")).toEqual({ npi: null, phone: "97451230", names: [] });
  });
  it("reads words as names, accents dropped, in any order", () => {
    expect(parseRegistryQuery("Issifou Nafissatou")).toEqual({ npi: null, phone: null, names: ["issifou", "nafissatou"] });
    expect(parseRegistryQuery("Sènami")?.names).toEqual(["senami"]);
  });
  it("escapes LIKE wildcards and refuses empty or too short input", () => {
    expect(parseRegistryQuery("a%b_c")?.names).toEqual(["abc"]);
    expect(parseRegistryQuery("  ")).toBeNull();
    expect(parseRegistryQuery("a")).toBeNull();
    expect(parseRegistryQuery("123")).toBeNull();
  });
});

describe("maskPhone", () => {
  it("keeps only the last four digits", () => {
    expect(maskPhone("0197451230")).toBe("•• •• 12 30");
    expect(maskPhone(null)).toBeNull();
  });
});
