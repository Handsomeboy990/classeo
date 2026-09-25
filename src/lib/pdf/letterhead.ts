// Official letterhead of every printed document: the Republic, the ministry
// in charge of the school's cycle, then the school. Text only for the
// Republic and the ministry: no coat of arms or emblem is reproduced. Pure,
// shared by the PDF documents and the HTML print views.

export type SchoolCycleCode = "PRESCHOOL" | "PRIMARY" | "SECONDARY" | "TECHNICAL";

export const REPUBLIC = "République du Bénin";

export const MINISTRIES = {
  primary: "Ministère des Enseignements Maternel et Primaire",
  secondary: "Ministère des Enseignements Secondaire, Technique et de la Formation Professionnelle",
} as const;

// Preschool and primary schools answer to the MEMP, secondary and technical
// schools to the MESTFP. A territorial document (statistics of a commune,
// a department, the nation) covers both.
export function ministriesFor(cycle: SchoolCycleCode | null | undefined): string[] {
  if (cycle === "PRESCHOOL" || cycle === "PRIMARY") return [MINISTRIES.primary];
  if (cycle === "SECONDARY" || cycle === "TECHNICAL") return [MINISTRIES.secondary];
  return [MINISTRIES.primary, MINISTRIES.secondary];
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
