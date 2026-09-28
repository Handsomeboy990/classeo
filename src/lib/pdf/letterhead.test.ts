import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createElement, type FC } from "react";

import { renderToBuffer } from "@react-pdf/renderer";

import { BRAND_DEFAULTS } from "@/components/brand/settings";
import { encodeQr } from "@/lib/qr";

import { Signatures } from "./components";
import { withDocumentScope } from "./context";
import { prepareFonts } from "./fonts";
import { DocumentPage, PdfDocument, T } from "./layout";
import { contactLine, pdfImageFormat, REPUBLIC, supervisingMinistry } from "./letterhead";

// Owner's decision D6: a school document names its real issuer chain, the
// Republic, the ministry that supervises the school, then the school.
describe("letterhead words", () => {
  it("opens on the Republic", () => {
    expect(REPUBLIC).toBe("République du Bénin");
  });

  it("names the ministry that supervises the school, from its cycle", () => {
    const memp = "Ministère des Enseignements Maternel et Primaire";
    const mestfp = "Ministère des Enseignements Secondaire, Technique et de la Formation Professionnelle";
    expect(supervisingMinistry("PRESCHOOL")).toBe(memp);
    expect(supervisingMinistry("PRIMARY")).toBe(memp);
    expect(supervisingMinistry("SECONDARY")).toBe(mestfp);
    expect(supervisingMinistry("TECHNICAL")).toBe(mestfp);
  });

  it("does not guess the ministry of a school whose cycle is unknown", () => {
    expect(supervisingMinistry(null)).toBe("Ministères en charge de l'éducation");
    expect(supervisingMinistry(undefined)).toBe("Ministères en charge de l'éducation");
  });
});

describe("contactLine", () => {
  it("joins the postal box, the phone and the e-mail", () => {
    expect(contactLine({ postalBox: "123 Godomey", phone: "01 21 00 00 00", email: "ceg@classeo.bj" })).toBe("BP 123 Godomey · Tél. 01 21 00 00 00 · ceg@classeo.bj");
    expect(contactLine({ postalBox: "BP 45 Cotonou" })).toBe("BP 45 Cotonou");
    expect(contactLine({})).toBe("");
  });
});

describe("pdfImageFormat", () => {
  it("keeps only the formats the PDF renderer draws", () => {
    expect(pdfImageFormat("image/png")).toBe("png");
    expect(pdfImageFormat("image/jpeg")).toBe("jpg");
    expect(pdfImageFormat("image/webp")).toBeNull();
    expect(pdfImageFormat("image/svg+xml")).toBeNull();
  });
});

describe("document rendering", () => {
  it("prints the letterhead and the verification footer given by the context", async () => {
    await prepareFonts();
    const url = "http://localhost:3000/verifier/K7QD4-M2XPH";
    const meta = {
      title: "Attestation de scolarité",
      reference: "ATT-20260925-0K4QZ7M",
      generatedAt: new Date("2026-09-25T10:00:00Z"),
      generatedBy: { name: "Florentin Agossou", role: "Chef d'établissement", email: "florentin.agossou" },
      issuer: { kind: "school" as const, name: "CEG Godomey", cycle: "SECONDARY" as const, postalBox: "123", code: "X" },
    };
    const Page = DocumentPage as unknown as FC<{ meta: typeof meta }>;
    const Doc = PdfDocument as unknown as FC<{ title: string; author: string }>;
    const page = createElement(Page, { meta }, createElement(T, null, "Contenu"), createElement(Signatures, { items: [{ role: "Le directeur", stamp: true }] }));
    const doc = createElement(Doc, { title: "t", author: "a" }, page);
    const buffer = await withDocumentScope(
      {
        verification: { code: "K7QD4-M2XPH", url, shortUrl: url.slice(7), qr: encodeQr(url) },
        signed: { name: "Florentin Agossou", role: "Chef", signedAt: new Date(), signature: null, stamp: null },
      },
      () => renderToBuffer(doc as unknown as Parameters<typeof renderToBuffer>[0]),
    );
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    // The scope reaches the footer and the signature block.
    expect(buffer.length).toBeGreaterThan(8000);

    // The coat of arms follows the official option: the same document
    // without it is lighter by the embedded image.
    const plain = await withDocumentScope({ verification: null, signed: null, brand: { ...BRAND_DEFAULTS, official: false } }, () =>
      renderToBuffer(doc as unknown as Parameters<typeof renderToBuffer>[0]),
    );
    const withArms = await withDocumentScope({ verification: null, signed: null, brand: { ...BRAND_DEFAULTS, official: true } }, () =>
      renderToBuffer(doc as unknown as Parameters<typeof renderToBuffer>[0]),
    );
    expect(withArms.length - plain.length).toBeGreaterThan(20_000);
    expect(plain.includes("/Subtype /Image")).toBe(false);
    expect(withArms.includes("/Subtype /Image")).toBe(true);
  }, 30_000);
});
