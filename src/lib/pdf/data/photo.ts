import "server-only";

import { readFileBytes } from "@/lib/files";

export type PdfPhoto = { data: Buffer; format: "png" | "jpg" };

// A student photo ready for a PDF. The PDF engine reads PNG and JPEG only: a
// WebP photo (uploaded without the browser resize) is left out rather than
// failing the whole document. Callers already authorized the document.
export async function studentPhoto(fileId: string | null | undefined): Promise<PdfPhoto | null> {
  const file = await readFileBytes(fileId);
  if (!file) return null;
  if (file.mimeType === "image/png") return { data: file.data, format: "png" };
  if (file.mimeType === "image/jpeg") return { data: file.data, format: "jpg" };
  return null;
}
