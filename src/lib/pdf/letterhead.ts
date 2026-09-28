// Words of the letterhead of every printed document, and of the e-mail
// header. Pure, shared by the PDF documents, the HTML print views and the
// e-mails.
//
// A school document names its real issuer chain (owner's decision D6,
// design source of truth 4.14): the coat of arms, "République du Bénin",
// the ministry that supervises the school, chosen from its cycle, then the
// school, which issues the document. A document of a territorial service
// or of the national level (statistics, teacher file) names that service
// under "République du Bénin" instead. Classéo appears in the footer only.

import { chainOfCycle, MINISTRIES_NAME, MINISTRY_OF } from "@/lib/domain/chains";

export type SchoolCycleCode = "PRESCHOOL" | "PRIMARY" | "SECONDARY" | "TECHNICAL";

export const REPUBLIC = "République du Bénin";

// The e-mail header reads like the brand lockup of the site (decision D5,
// src/components/brand/lockup.tsx); the documents do not use these words.
export const PRODUCT = "Classéo";
export const PRODUCT_LINE = "Plateforme de gestion scolaire";

// The ministry that supervises a school: nursery and primary schools answer
// to the MEMP, secondary general and technical schools to the MESTFP. A
// school whose cycle is unknown gets the collective name rather than a
// guess.
export function supervisingMinistry(cycle: SchoolCycleCode | null | undefined): string {
  return cycle ? MINISTRY_OF[chainOfCycle(cycle)].name : MINISTRIES_NAME;
}

// "BP 123 Cotonou · Tél. 01 21 30 00 00 · ceg.godomey@classeo.bj": the
// contact line under the school name, empty parts left out.
export function contactLine(s: { postalBox?: string | null; phone?: string | null; email?: string | null }) {
  const box = s.postalBox?.trim();
  return [box ? (/^b\.?p\.?\s/i.test(box) ? box : `BP ${box}`) : null, s.phone ? `Tél. ${s.phone}` : null, s.email || null].filter(Boolean).join(" · ");
}

// Formats React PDF can draw from bytes. WebP and SVG logos are left out of
// the PDF (the HTML views still show them).
export function pdfImageFormat(mimeType: string): "png" | "jpg" | null {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  return null;
}
