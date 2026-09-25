import { createContext, useContext } from "react";

import type { QrMatrix } from "@/lib/qr";

// Filled by exportPdf() around the document it renders, so every page footer
// prints the verification code and its QR code, and the signature block of a
// signed document draws the signer's images, without each document having to
// carry them.

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

export const VerificationContext = createContext<DocumentVerification | null>(null);
export const SignedContext = createContext<DocumentSigned | null>(null);

export const useVerification = () => useContext(VerificationContext);
export const useSigned = () => useContext(SignedContext);
