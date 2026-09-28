// Letterhead of every printed document, read like the brand lockup of the
// site (owner's decision D5): "République du Bénin" as a small overline,
// then the product, Classéo, and what it is; no ministry or other
// institution is named. The school (or the territorial service) that issues
// the document follows. Pure, shared by the PDF documents, the HTML print
// views and the e-mails.

export type SchoolCycleCode = "PRESCHOOL" | "PRIMARY" | "SECONDARY" | "TECHNICAL";

export const REPUBLIC = "République du Bénin";

// The same words as the lockup (src/components/brand/lockup.tsx).
export const PRODUCT = "Classéo";
export const PRODUCT_LINE = "Plateforme de gestion scolaire";

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
