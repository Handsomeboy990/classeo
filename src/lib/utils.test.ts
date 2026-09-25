import { describe, expect, it } from "vitest";

import { de, formatClock, formatDate, formatDateTime, formatTime, plural, sortByName } from "./utils";

describe("de", () => {
  it("elides before a vowel, accented or not", () => {
    expect(de("Estelle Amoussou")).toBe("d'Estelle Amoussou");
    expect(de("Éric")).toBe("d'Éric");
    expect(de("Aïcha")).toBe("d'Aïcha");
  });

  it("elides before a mute h only", () => {
    expect(de("Hélène")).toBe("d'Hélène");
    expect(de("Hounkpatin Sènami")).toBe("de Hounkpatin Sènami");
  });

  it("keeps de before a consonant", () => {
    expect(de("Florentin Agossou")).toBe("de Florentin Agossou");
  });
});

describe("sortByName", () => {
  it("sorts family names in French order, accents ignored", () => {
    const rows = ["Adjovi", "Adéoti", "Zannou", "adékambi", "Àkpovi"].map((lastName) => ({ lastName, firstName: "Afi" }));
    expect(sortByName(rows, (r) => r).map((r) => r.lastName)).toEqual(["adékambi", "Adéoti", "Adjovi", "Àkpovi", "Zannou"]);
  });

  it("breaks ties on the first name", () => {
    const rows = [
      { lastName: "Dossou", firstName: "Élodie" },
      { lastName: "Dossou", firstName: "Codjo" },
    ];
    expect(sortByName(rows, (r) => r).map((r) => r.firstName)).toEqual(["Codjo", "Élodie"]);
  });
});

describe("plural", () => {
  it("writes the singular for zero and one, the plural from two", () => {
    expect(plural(0, "fiche")).toBe("0 fiche");
    expect(plural(1, "note enregistrée", "notes enregistrées")).toBe("1 note enregistrée");
    expect(plural(3, "note enregistrée", "notes enregistrées")).toBe("3 notes enregistrées");
  });
});

describe("dates and times", () => {
  it("never pads the day of a date", () => {
    expect(formatDate(new Date("2026-10-09T10:00:00Z"))).toBe("9 octobre 2026");
    expect(formatDate(new Date("2026-10-01T10:00:00Z"))).toBe("1er octobre 2026");
  });

  it("writes clock times the French way", () => {
    expect(formatClock("07:00")).toBe("7 h");
    expect(formatClock("09:15")).toBe("9 h 15");
    expect(formatClock("15:00")).toBe("15 h");
  });

  it("reads instants in Benin time", () => {
    expect(formatTime(new Date("2026-09-25T06:05:00Z"))).toBe("7 h 05");
    expect(formatDateTime(new Date("2026-09-25T13:00:00Z"))).toBe("25 sept. à 14 h");
  });
});
