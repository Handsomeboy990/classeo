import { describe, expect, it } from "vitest";

import { buildNameIndex, contactOrIdentifier, fillTemplate, foldName, freeTextPlan, fragmentCore, interfaceDecision, knownNamesIn, MAX_QUEUE_LENGTH, privateTemplate } from "./privacy";

// Names of the demonstration data (prisma/seed.ts, src/lib/demo/accounts.ts).
const index = buildNameIndex(["Afiavi", "Hounkpatin", "Sènami", "Florentin", "Agossou", "Grâce", "Marie-Chantal", "Dossou Yovo", "Da"]);

describe("name index", () => {
  it("folds accents and case, splits compound names, ignores parts under 3 letters", () => {
    expect(foldName("SÈNAMI")).toBe("senami");
    expect(index.has("senami")).toBe(true);
    expect(index.has("marie")).toBe(true);
    expect(index.has("chantal")).toBe(true);
    expect(index.has("yovo")).toBe(true);
    expect(index.has("da")).toBe(false);
  });

  it("finds names written as names, not lower case words of the sentence", () => {
    expect(knownNamesIn("Nouveau message de Afiavi Hounkpatin", index)).toEqual(["Afiavi Hounkpatin"]);
    expect(knownNamesIn("HOUNKPATIN Sènami, Florentin Agossou", index)).toEqual(["HOUNKPATIN Sènami", "Florentin Agossou"]);
    expect(knownNamesIn("Senami a écrit", index)).toEqual(["Senami"]);
    expect(knownNamesIn("grâce à vous", index)).toEqual([]);
    expect(knownNamesIn("Bulletin de Marie-Chantal", index)).toEqual(["Marie-Chantal"]);
  });
});

describe("contact details and identifiers", () => {
  it.each([
    ["Écrire à parent@classeo.bj", "email"],
    ["Voir https://example.org", "email"],
    ["Appelez le 97 12 34 56", "phone"],
    ["Numéro +229 01 97 12 34 56", "phone"],
    ["Facture FAC-2026-0242", "identifier"],
    ["Matricule BJ26000242", "identifier"],
    ["Code 1234567", "identifier"],
  ])("refuses %s", (text, reason) => {
    expect(contactOrIdentifier(text)).toBe(reason);
  });

  it("lets ordinary figures through", () => {
    expect(contactOrIdentifier("Trimestre 2 2025-2026")).toBeNull();
    expect(contactOrIdentifier("3 absences")).toBeNull();
  });
});

describe("interfaceDecision", () => {
  it("never queues a demo person's name: the template is queued instead", () => {
    const d = interfaceDecision("Nouveau message de Afiavi Hounkpatin", index);
    expect(d).toEqual({ ok: true, send: "Nouveau message de 2", templated: true });
    expect(JSON.stringify(d)).not.toMatch(/Afiavi|Hounkpatin/);
  });

  it("templates the names of the reader's page as well", () => {
    const d = interfaceDecision("Bulletin de Koffi", index, ["Koffi"]);
    expect(d).toEqual({ ok: true, send: "Bulletin de 2", templated: true });
  });

  it("templates figures", () => {
    expect(interfaceDecision("Il reste 12 jours", index)).toEqual({ ok: true, send: "Il reste 2 jours", templated: true });
  });

  it("queues plain interface labels as they are", () => {
    expect(interfaceDecision("Voir le bulletin", index)).toEqual({ ok: true, send: "Voir le bulletin", templated: false });
  });

  it("refuses contact details, identifiers and long strings", () => {
    expect(interfaceDecision("Contact : parent@classeo.bj", index)).toEqual({ ok: false, reason: "email" });
    expect(interfaceDecision("Appelez le 97 12 34 56", index)).toEqual({ ok: false, reason: "phone" });
    expect(interfaceDecision("Reçu K6W9P-5GQMY", index)).toEqual({ ok: false, reason: "identifier" });
    expect(interfaceDecision("a".repeat(10) + " " + "mot ".repeat(20), index)).toEqual({ ok: false, reason: "length" });
    expect(MAX_QUEUE_LENGTH).toBe(80);
  });

  it("refuses a string that is only a name", () => {
    const d = interfaceDecision("Sènami Hounkpatin", index);
    expect(d.ok).toBe(false);
  });
});

describe("freeTextPlan", () => {
  it("sends templates, keeps contact details French and flags personal data", () => {
    const plan = freeTextPlan(["Bulletin de Sènami Hounkpatin : moyenne 13,5 sur 20.", "Appelez le 97 12 34 56.", "Bonne lecture."], index);
    expect(plan.personal).toBe(true);
    expect(plan.segments[0]).toMatchObject({ key: "Bulletin de 2 : moyenne 3 sur 4." });
    expect(plan.segments[1]).toMatchObject({ refused: "phone" });
    expect(plan.segments[2]).toMatchObject({ key: "Bonne lecture." });
    expect(JSON.stringify(plan.segments.map((s) => ("key" in s ? s.key : "")))).not.toMatch(/Sènami|Hounkpatin|97/);
  });

  it("is not personal without names or contact details", () => {
    expect(freeTextPlan(["Vous avez 3 absences."], index).personal).toBe(false);
  });

  it("puts the values back in the translation", () => {
    const { key, values } = privateTemplate("Bulletin de Sènami : 13,5", index);
    expect(key).toBe("Bulletin de 2 : 3");
    expect(fillTemplate("Bulletin 2 tɔn : 3", values)).toBe("Bulletin Sènami tɔn : 13,5");
  });
});

it("fragmentCore drops the ellipsis of an excerpt", () => {
  expect(fragmentCore("  Bonjour madame, je voulais…")).toBe("Bonjour madame, je voulais");
  expect(fragmentCore("Bonjour...")).toBe("Bonjour");
});
