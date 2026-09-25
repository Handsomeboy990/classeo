import { describe, expect, it } from "vitest";

import { calendarError, isoToUtc, overlaps, yearLabelError, yearStatus } from "./rules";

const d = isoToUtc;
const start = d("2026-09-14");
const end = d("2027-07-02");
const terms = [
  { name: "Trimestre 1", startDate: d("2026-09-14"), endDate: d("2026-12-18") },
  { name: "Trimestre 2", startDate: d("2027-01-04"), endDate: d("2027-03-26") },
  { name: "Trimestre 3", startDate: d("2027-04-12"), endDate: d("2027-07-02") },
];

describe("calendarError", () => {
  it("accepts three terms inside the year", () => {
    expect(calendarError(start, end, terms)).toBeNull();
  });
  it("accepts two semesters", () => {
    expect(
      calendarError(start, end, [
        { name: "Semestre 1", startDate: d("2026-09-14"), endDate: d("2027-01-29") },
        { name: "Semestre 2", startDate: d("2027-02-01"), endDate: d("2027-07-02") },
      ]),
    ).toBeNull();
  });
  it("refuses a period outside the year, overlapping periods and a single period", () => {
    expect(calendarError(start, end, [{ ...terms[0]!, startDate: d("2026-09-01") }, terms[1]!, terms[2]!])).toMatch(/entre le début et la fin/);
    expect(calendarError(start, end, [terms[0]!, { ...terms[1]!, startDate: d("2026-12-18") }, terms[2]!])).toMatch(/commencer après la fin de Trimestre 1/);
    expect(calendarError(start, end, [terms[0]!])).toMatch(/2 à 4 périodes/);
  });
  it("refuses a year shorter than six months or ending before it starts", () => {
    expect(calendarError(start, d("2026-12-01"), terms)).toMatch(/entre 6 et 13 mois/);
    expect(calendarError(end, start, terms)).toMatch(/fin doit suivre/);
  });
  it("refuses two periods with the same name", () => {
    expect(calendarError(start, end, [terms[0]!, { ...terms[1]!, name: "trimestre 1" }, terms[2]!])).toMatch(/même nom/);
  });
});

describe("yearLabelError", () => {
  it("wants two consecutive years starting with the year of the start date", () => {
    expect(yearLabelError("2026-2027", start)).toBeNull();
    expect(yearLabelError("2026-2028", start)).toMatch(/se suivent/);
    expect(yearLabelError("2027-2028", start)).toMatch(/commencer en 2027/);
    expect(yearLabelError("26-27", start)).toMatch(/s'écrit/);
  });
});

describe("overlaps and status", () => {
  it("detects overlapping years", () => {
    expect(overlaps({ startDate: start, endDate: end }, { startDate: d("2027-07-01"), endDate: d("2028-07-01") })).toBe(true);
    expect(overlaps({ startDate: start, endDate: end }, { startDate: d("2027-09-13"), endDate: d("2028-07-01") })).toBe(false);
  });
  it("names the status of a year", () => {
    const now = d("2026-10-01");
    expect(yearStatus({ isActive: true, startDate: start }, false, now)).toBe("ACTIVE");
    expect(yearStatus({ isActive: true, startDate: start }, true, now)).toBe("CLOSED");
    expect(yearStatus({ isActive: false, startDate: d("2027-09-13") }, false, now)).toBe("UPCOMING");
  });
});
