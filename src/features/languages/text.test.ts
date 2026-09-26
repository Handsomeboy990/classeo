import { describe, expect, it } from "vitest";

import { isTranslatable, lookupKeys, lookupText, namePattern, numberTemplate } from "./text";

describe("number templates", () => {
  it("shares one entry between strings that differ by their figures", () => {
    expect(numberTemplate("3 absences")?.key).toBe("2 absences");
    expect(numberTemplate("5 absences")?.key).toBe("2 absences");
    expect(numberTemplate("Trimestre 1 · 14 notes")?.key).toBe("Trimestre 1 · 2 notes");
    expect(numberTemplate("Mes enfants")).toBeNull();
    // Identifiers are one value, never words.
    expect(numberTemplate("Réf. BUL-2026-0SPIJLF")?.key).toBe("Réf. 2");
    expect(numberTemplate("Facture FAC-2026-0242 · CE2 A")?.key).toBe("Facture 2 · CE3 A");
    expect(lookupKeys("3 absences")).toEqual(["3 absences", "2 absences"]);
  });
  it("gives the figures back by value, in the order of the translation", () => {
    const map = new Map([
      ["2 absences", "Afɔ 2 ɖě e è ma wá"],
      ["Note 2 sur 3", "3 mɛ 2"],
    ]);
    expect(lookupText("7 absences", map)).toBe("Afɔ 7 ɖě e è ma wá");
    expect(lookupText("Note 13,5 sur 20", map)).toBe("20 mɛ 13,5");
    expect(lookupText("1 absence", map)).toBeUndefined();
  });
});

describe("names, fragments and sentences", () => {
  const names = namePattern(["Sènami", "Hounkpatin", "Sènami Hounkpatin", "HOUNKPATIN Sènami", "3e A"]);

  it("keeps names out of the key, one slot per name, the full name first", () => {
    expect(numberTemplate("Bulletin de Sènami", names)?.key).toBe("Bulletin de 2");
    expect(numberTemplate("Sènami Hounkpatin, classe de 3e A", names)?.key).toBe("2, classe de 3");
    expect(numberTemplate("Notes de Sènami : 7 matières sur 7", names)?.key).toBe("Notes de 2 : 3 matières sur 3");
    // A name inside a word is not a name.
    expect(numberTemplate("Sènamidé", names)).toBeNull();
    expect(lookupKeys("Bulletin de Sènami", () => null, names)).toEqual(["Bulletin de Sènami", "Bulletin de 2"]);
  });

  it("gives the names back in the translation", () => {
    const map = new Map([["2 était absente le jeudi 3 septembre.", "2 ma wá azɔ̌ ɖò 3 zosun."]]);
    expect(lookupText("Sènami était absente le jeudi 24 septembre.", map, undefined, names)).toBe("Sènami ma wá azɔ̌ ɖò 24 zosun.");
  });

  it("looks up a fragment without its bullets and brackets", () => {
    const map = new Map([
      ["publié le", "è tò"],
      ["Enseignante", "Mɛ̀ tɔn"],
    ]);
    expect(lookupText("· publié le", map)).toBe("· è tò");
    expect(lookupText("(Enseignante,", map)).toBe("(Mɛ̀ tɔn,");
    expect(lookupKeys("· publié le")).toContain("publié le");
  });

  it("translates a list separated by middle dots part by part, values kept", () => {
    const map = new Map([
      ["épreuves du", "tɛnkpɔn"],
      ["Direction départementale 2", "Azɔ̌xɔsa 2"],
    ]);
    const places = namePattern(["Atlantique"]);
    const other = (t: string) => (t === "épreuves du 26 octobre 2026 au 27 octobre 2026" ? "tɛnkpɔn 26 zŏsùn 2026 – 27 zŏsùn 2026" : undefined);
    expect(lookupText("3e · épreuves du 26 octobre 2026 au 27 octobre 2026 · Direction départementale Atlantique", map, other, places)).toBe(
      "3e · tɛnkpɔn 26 zŏsùn 2026 – 27 zŏsùn 2026 · Azɔ̌xɔsa Atlantique",
    );
    expect(lookupText("3e · Une phrase inconnue", map, other, places)).toBeUndefined();
    expect(lookupKeys("3e · Direction départementale Atlantique", () => null, places)).toContain("Direction départementale 2");
  });

  it("translates a text sentence by sentence when every sentence is known", () => {
    const map = new Map([
      ["Aucune absence cette semaine.", "Afɔ ɖě ǎ."],
      ["2, classe de 3.", "2, klasi 3."],
    ]);
    expect(lookupText("Sènami, classe de 3e A. Aucune absence cette semaine.", map, undefined, names)).toBe("Sènami, klasi 3e A. Afɔ ɖě ǎ.");
    expect(lookupText("Sènami, classe de 3e A. Une autre phrase.", map, undefined, names)).toBeUndefined();
    const long = Array.from({ length: 8 }, (_, i) => `Phrase numéro ${i} du guide, assez longue pour compter.`).join(" ");
    expect(long.length).toBeGreaterThan(300);
    expect(isTranslatable(long)).toBe(true);
    expect(isTranslatable("x".repeat(400))).toBe(false);
  });
});
