import { AsyncLocalStorage } from "node:async_hooks";

import { BRAND_DEFAULTS, type BrandSettings } from "@/components/brand/settings";
import type { QrMatrix } from "@/lib/qr";

// Set by exportPdf() around the render of a document, so every page footer
// prints the verification code and its QR code, and the signature block of
// a signed document draws the signer's images, without each document having
// to carry them. React context is not available to route handlers (they run
// under the react-server condition), hence an async local store: the
// renderer calls the components, render props included, inside its scope.

export type PdfImage = { data: Buffer; format: "png" | "jpg" };

export type DocumentVerification = {
  code: string;
  url: string;
  shortUrl: string;
  qr: QrMatrix;
};

export type DocumentSigned = {
  name: string;
  role: string;
  signedAt: Date;
  signature: PdfImage | null;
  stamp: PdfImage | null;
};

// brand: the two brand options (coat of arms on the letterhead,
// independence notice in the footer), read once per export; the defaults
// when absent.
type Scope = { verification: DocumentVerification | null; signed: DocumentSigned | null; brand?: BrandSettings };

const store = new AsyncLocalStorage<Scope>();

export function withDocumentScope<T>(scope: Scope, render: () => T): T {
  return store.run(scope, render);
}

export const currentVerification = () => store.getStore()?.verification ?? null;
export const currentSigned = () => store.getStore()?.signed ?? null;
export const currentBrand = () => store.getStore()?.brand ?? BRAND_DEFAULTS;
