import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createElement } from "react";

import { renderToBuffer } from "@react-pdf/renderer";

import { encodeQr } from "@/lib/qr";

import { Signatures } from "./components";
import { SignedContext, VerificationContext } from "./context";
import { prepareFonts } from "./fonts";
import { DocumentPage, PdfDocument, T } from "./layout";
import { contactLine, MINISTRIES, ministriesFor, pdfImageFormat } from "./letterhead";

describe("ministriesFor", () => {
  it("names the ministry of the school's cycle", () => {
    expect(ministriesFor("PRESCHOOL")).toEqual([MINISTRIES.primary]);
    expect(ministriesFor("PRIMARY")).toEqual(["Ministère des Enseignements Maternel et Primaire"]);
    expect(ministriesFor("SECONDARY")).toEqual(["Ministère des Enseignements Secondaire, Technique et de la Formation Professionnelle"]);
    expect(ministriesFor("TECHNICAL")).toEqual([MINISTRIES.secondary]);
  });

  it("names both ministries on a territorial document", () => {
    expect(ministriesFor(null)).toEqual([MINISTRIES.primary, MINISTRIES.secondary]);
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
    const page = createElement(DocumentPage, {
      meta,
      children: [createElement(T, { key: "t" }, "Contenu"), createElement(Signatures, { key: "s", items: [{ role: "Le directeur", stamp: true }] })],
    });
    const doc = createElement(PdfDocument, { title: "t", author: "a", children: page });
    const element = createElement(
      VerificationContext.Provider,
      { value: { code: "K7QD4-M2XPH", url, shortUrl: url.slice(7), qr: encodeQr(url) } },
      createElement(SignedContext.Provider, { value: { name: "Florentin Agossou", role: "Chef", signedAt: new Date(), signature: null, stamp: null } }, doc),
    );
    const buffer = await renderToBuffer(element as unknown as Parameters<typeof renderToBuffer>[0]);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    // The renderer accepts the context providers above the document root.
    expect(buffer.length).toBeGreaterThan(8000);
  }, 30_000);
});
