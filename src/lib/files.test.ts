import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));

import { validateUpload } from "./files";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const pdf = new TextEncoder().encode("%PDF-1.7 ...");

describe("validateUpload", () => {
  it("accepts a file whose content matches an allowed type", () => {
    expect(validateUpload("student_photo", { size: png.length, type: "image/png" }, png)).toBe("image/png");
    expect(validateUpload("document", { size: pdf.length, type: "application/pdf" }, pdf)).toBe("application/pdf");
  });
  it("refuses a disguised file, an oversized file and a type not allowed for the purpose", () => {
    const script = new TextEncoder().encode("<script>alert(1)</script>");
    expect(() => validateUpload("student_photo", { size: script.length, type: "image/png" }, script)).toThrow();
    expect(() => validateUpload("student_photo", { size: 2_000_000, type: "image/png" }, png)).toThrow();
    expect(() => validateUpload("signature", { size: pdf.length, type: "application/pdf" }, pdf)).toThrow();
  });
  it("refuses an SVG logo carrying a script", () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" onload="x()"></svg>');
    expect(() => validateUpload("school_logo", { size: svg.length, type: "image/svg+xml" }, svg)).toThrow();
  });
});
