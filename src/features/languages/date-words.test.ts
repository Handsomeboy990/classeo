import { describe, expect, it } from "vitest";

import { dateLabel, translateDate, translateDated } from "./date-words";
import { lookupKeys, lookupText } from "./text";

describe("date words", () => {
  it("writes day and month names from the table, never a French abbreviation", () => {
    expect(translateDate("Jeu. 12 sept.", "fon")).toBe("Nyɔnuzangbé 12 zosun");
    expect(translateDate("Jeudi 12 septembre 2026", "yo")).toBe("Ọjọ́bọ 12 Oṣù Owewe 2026");
    expect(translateDate("sept", "fon")).toBe("zosun");
    expect(translateDate("1er octobre 2026", "fon")).toBe("1 zŏsùn 2026");
  });
  it("writes times in figures and leaves no French word", () => {
    expect(translateDate("Samedi 10 octobre à 11 h", "fon")).toBe("Síbígbé 10 zŏsùn, 11:00");
    expect(translateDate("25 sept. à 14 h 05", "yo")).toBe("25 Oṣù Owewe, 14:05");
  });
  it("tells a short Tuesday from March and refuses any other word", () => {
    expect(translateDate("mar. 3 mars", "fon")).toBe("taatagbé 3 xwéjisun");
    expect(translateDate("mar 3", "fon")).toBeUndefined();
    expect(translateDate("Réunion le 12 septembre", "fon")).toBeUndefined();
    expect(translateDate("12 septembre", "bab")).toBeUndefined();
    expect(translateDate("Mes enfants", "fon")).toBeUndefined();
  });
  it("writes a range with a dash and drops the article", () => {
    expect(translateDate("du 21 septembre 2026 au 23 septembre 2026", "fon")).toBe("21 zosun 2026 – 23 zosun 2026");
    expect(translateDate("le jeudi 24 septembre", "fon")).toBe("nyɔnuzangbé 24 zosun");
  });
  it("translates the label before a date from the cache, the date from the table", () => {
    const map = new Map([["Publié le", "È tò è ɖò"]]);
    expect(dateLabel("Publié le 22 septembre 2026")).toEqual({ label: "Publié le", date: "22 septembre 2026" });
    expect(translateDated("Publié le 22 septembre 2026", "fon", (t) => map.get(t))).toBe("È tò è ɖò 22 zosun 2026");
    expect(translateDated("Modifié le 22 septembre 2026", "fon", (t) => map.get(t))).toBeUndefined();
    expect(lookupKeys("Publié le 22 septembre 2026", dateLabel)).toContain("Publié le");
  });
  it("serves as the value of a known label", () => {
    const map = new Map([["Prochaine réunion", "Kplé e bɔ̀"]]);
    expect(lookupText("Prochaine réunion : samedi 10 octobre", map, (t) => translateDate(t, "fon"))).toBe("Kplé e bɔ̀ : síbígbé 10 zŏsùn");
  });
});
