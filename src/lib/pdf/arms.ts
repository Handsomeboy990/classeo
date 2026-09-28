import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { PdfImage } from "./context";

// The coat of arms of the letterhead: a PNG rendered once from the
// Wikimedia Commons drawing (CC BY-SA 3.0, licence next to the file), 600
// pixels wide, since the PDF renderer draws no SVG image. The path is a
// literal joined to process.cwd(), the form the output file tracing
// follows, like the fonts. Read once per process.
export const ARMS_PNG_RATIO = 600 / 530;

let arms: PdfImage | null = null;

export function armsImage(): PdfImage {
  arms ??= { data: readFileSync(join(process.cwd(), "src/lib/pdf/brand/armoiries-benin.png")), format: "png" };
  return arms;
}
