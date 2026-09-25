import "server-only";

import { db } from "@/lib/db";
import { fileUrl, readFileBytes } from "@/lib/files";

import type { Issuer } from "../layout";
import { pdfImageFormat } from "../letterhead";

// Completes a school issuer with what the letterhead needs and the loaders
// do not select: the cycle (which ministry), the postal box, the contact
// details and the logo. Looked up by the school code, unique, which every
// school issuer carries. A territorial issuer is returned as is.
export async function completeIssuer(issuer: Issuer, { withLogoBytes = true } = {}): Promise<Issuer> {
  if (issuer.kind !== "school" || !issuer.code) return issuer;
  const school = await db.school.findUnique({
    where: { code: issuer.code },
    select: { cycle: true, postalBox: true, phone: true, email: true, address: true, logoFileId: true },
  });
  if (!school) return issuer;
  const file = withLogoBytes ? await readFileBytes(school.logoFileId) : null;
  const format = file ? pdfImageFormat(file.mimeType) : null;
  return {
    ...issuer,
    cycle: school.cycle,
    postalBox: school.postalBox,
    phone: issuer.phone ?? school.phone,
    email: issuer.email ?? school.email,
    address: issuer.address ?? school.address,
    logo: file && format ? { data: file.data, format } : null,
    logoUrl: fileUrl(school.logoFileId),
  };
}
