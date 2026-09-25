import { describe, expect, it } from "vitest";

import {
  amountSentence,
  attachmentHeader,
  beninDate,
  beninDateTime,
  calendarDate,
  calendarShort,
  calendarWeekday,
  documentReference,
  duration,
  officialName,
  ordinal,
  pageLabel,
  pdfFcfa,
  pdfFileName,
  pdfText,
} from "./format";

describe("pdfText", () => {
  it("replaces the narrow no-break space the fonts lack with a no-break space", () => {
    expect(pdfText("12 345")).toBe("12 345");
    expect(pdfText("é è ô ç")).toBe("é è ô ç");
  });
});

describe("pdfFcfa", () => {
  it("groups thousands and keeps the currency on the line of its figure", () => {
    expect(pdfFcfa(1234567)).toBe("1 234 567 FCFA");
    expect(pdfFcfa(0)).toBe("0 FCFA");
  });
});

describe("amountSentence", () => {
  it("reuses the receipt spelling of the payments domain", () => {
    expect(amountSentence(20000)).toBe("vingt mille francs CFA");
    expect(amountSentence(180)).toBe("cent quatre-vingts francs CFA");
    expect(amountSentence(1_200_201)).toBe("un million deux cent mille deux cent un francs CFA");
  });
});

describe("dates in Benin time", () => {
  it("reads an instant in Africa/Porto-Novo (UTC+1)", () => {
    // 23:30 UTC on 30 September is already 1 October in Cotonou.
    const d = new Date("2026-09-30T23:30:00Z");
    expect(beninDate(d)).toBe("1er octobre 2026");
    expect(beninDateTime(d)).toBe("1er octobre 2026 à 00 h 30");
    expect(beninDateTime(new Date("2026-09-25T13:05:00Z"))).toBe("25 septembre 2026 à 14 h 05");
  });

  it("reads a calendar day stored at midnight UTC without shifting it", () => {
    const d = new Date("2012-11-20T00:00:00Z");
    expect(calendarDate(d)).toBe("20 novembre 2012");
    expect(calendarShort(d)).toBe("20/11/2012");
    expect(calendarWeekday(new Date("2026-09-24T00:00:00Z"))).toBe("Jeudi 24 septembre 2026");
    expect(calendarWeekday(new Date("2026-10-01T00:00:00Z"))).toBe("Jeudi 1er octobre 2026");
  });
});

describe("documentReference", () => {
  const at = new Date("2026-09-25T08:00:00Z");

  it("has a kind, the day of generation and a fingerprint of the subject", () => {
    expect(documentReference("BUL", at, "enrollment-1", "period-1")).toMatch(/^BUL-20260925-[0-9A-Z]{7}$/);
  });

  it("is stable for the same subject and differs for another one", () => {
    const a = documentReference("BUL", at, "enrollment-1", "period-1");
    expect(documentReference("BUL", new Date("2026-09-25T20:00:00Z"), "enrollment-1", "period-1")).toBe(a);
    expect(documentReference("BUL", at, "enrollment-2", "period-1")).not.toBe(a);
    expect(documentReference("BUL", at, "enrollment-1", "period-2")).not.toBe(a);
  });

  it("uses the Benin day, not the UTC day", () => {
    expect(documentReference("ATT", new Date("2026-09-30T23:30:00Z"), "x")).toMatch(/^ATT-20261001-/);
  });

  it("keeps the prefix short and alphabetic", () => {
    expect(documentReference("rel-é", at, "x")).toMatch(/^REL-/);
    expect(documentReference("", at, "x")).toMatch(/^DOC-/);
  });
});

describe("pdfFileName", () => {
  it("gives a lower case ASCII name without accents", () => {
    expect(pdfFileName("Bulletin", "Trimestre 1", "2025-2026", "HOUNKPATIN", "Sènami")).toBe("bulletin-trimestre-1-2025-2026-hounkpatin-senami.pdf");
    expect(pdfFileName("Liste de classe", "1ère D")).toBe("liste-de-classe-1ere-d.pdf");
    expect(pdfFileName("Frère ou sœur")).toBe("frere-ou-soeur.pdf");
  });

  it("never produces an empty or path like name", () => {
    expect(pdfFileName("../../", null, undefined)).toBe("document.pdf");
    expect(pdfFileName("a".repeat(300)).length).toBeLessThanOrEqual(124);
  });
});

describe("attachmentHeader", () => {
  it("sends an ASCII name and its UTF-8 form", () => {
    expect(attachmentHeader("recu-pay-2026-00003.pdf")).toBe(`attachment; filename="recu-pay-2026-00003.pdf"; filename*=UTF-8''recu-pay-2026-00003.pdf`);
    expect(attachmentHeader('a"b.pdf')).toContain('filename="a_b.pdf"');
  });
});

describe("small labels", () => {
  it("writes page numbers in French", () => {
    expect(pageLabel(1, 3)).toBe("Page 1 sur 3");
  });

  it("writes family names in capitals", () => {
    expect(officialName("Hounkpatin", "Sènami")).toBe("HOUNKPATIN Sènami");
    expect(officialName("Dègbo", "Carine")).toBe("DÈGBO Carine");
  });

  it("writes ranks and durations", () => {
    expect(ordinal(1)).toBe("1er");
    expect(ordinal(2, true)).toBe("2e ex");
    expect(ordinal(null)).toBe("–");
    expect(duration(45)).toBe("45 min");
    expect(duration(120)).toBe("2 h");
    expect(duration(150)).toBe("2 h 30");
  });
});
