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
  it("recognises speech clips: MP3 with an ID3 tag or a bare frame, and WAV", () => {
    const id3 = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0, 0, 0]);
    const frame = new Uint8Array([0xff, 0xf3, 0x64, 0xc4, 0, 0]);
    const wav = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20]);
    expect(validateUpload("tts_audio", { size: id3.length, type: "audio/mpeg" }, id3)).toBe("audio/mpeg");
    expect(validateUpload("tts_audio", { size: frame.length, type: "audio/mpeg" }, frame)).toBe("audio/mpeg");
    expect(validateUpload("tts_audio", { size: wav.length, type: "audio/wav" }, wav)).toBe("audio/wav");
  });
  it("refuses what only looks like an MP3 frame, and audio for another purpose", () => {
    // Reserved layer, then the "bad" bitrate index.
    const reservedLayer = new Uint8Array([0xff, 0xf1, 0x64, 0xc4]);
    const badBitrate = new Uint8Array([0xff, 0xf3, 0xf4, 0xc4]);
    const html = new TextEncoder().encode("<html>Erreur</html>");
    for (const bytes of [reservedLayer, badBitrate, html]) expect(() => validateUpload("tts_audio", { size: bytes.length, type: "audio/mpeg" }, bytes)).toThrow();
    const frame = new Uint8Array([0xff, 0xf3, 0x64, 0xc4]);
    expect(() => validateUpload("document", { size: frame.length, type: "audio/mpeg" }, frame)).toThrow();
    // A JPEG keeps its type: FF D8 is not an MP3 sync word.
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    expect(validateUpload("student_photo", { size: jpeg.length, type: "image/jpeg" }, jpeg)).toBe("image/jpeg");
  });
  describe("voice notes", () => {
    const ebml = (docType: string) => new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0x82, 0x84, ...new TextEncoder().encode(docType), 0x42, 0x87]);
    const ftyp = (brand: string) => new Uint8Array([0, 0, 0, 0x18, ...new TextEncoder().encode(`ftyp${brand}`), 0, 0, 0, 0]);
    const ogg = new TextEncoder().encode("OggS\u0000\u0002rest");

    it("recognises the recordings of Chrome (WebM), Firefox (Ogg) and Safari (MP4)", () => {
      expect(validateUpload("voice_note", { size: 20, type: "audio/webm" }, ebml("webm"))).toBe("audio/webm");
      expect(validateUpload("voice_note", { size: 20, type: "audio/ogg" }, ogg)).toBe("audio/ogg");
      expect(validateUpload("voice_note", { size: 20, type: "audio/mp4" }, ftyp("iso5"))).toBe("audio/mp4");
      expect(validateUpload("voice_note", { size: 20, type: "audio/mp4" }, ftyp("M4A "))).toBe("audio/mp4");
      const wav = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20]);
      expect(validateUpload("voice_note", { size: wav.length, type: "audio/wav" }, wav)).toBe("audio/wav");
    });
    it("ignores the declared type: the bytes decide", () => {
      expect(validateUpload("voice_note", { size: 20, type: "text/html" }, ebml("webm"))).toBe("audio/webm");
    });
    it("refuses another Matroska document, an unknown MP4 brand, a disguised page and a recording over 2 MB", () => {
      expect(() => validateUpload("voice_note", { size: 20, type: "audio/webm" }, ebml("matroska"))).toThrow("Format");
      expect(() => validateUpload("voice_note", { size: 20, type: "audio/mp4" }, ftyp("qt  "))).toThrow("Format");
      const html = new TextEncoder().encode("<html><script>x()</script></html>");
      expect(() => validateUpload("voice_note", { size: html.length, type: "audio/webm" }, html)).toThrow("Format");
      expect(() => validateUpload("voice_note", { size: 2_000_001, type: "audio/webm" }, ebml("webm"))).toThrow("2 Mo");
    });
    it("keeps audio out of the other purposes and images out of voice notes", () => {
      expect(() => validateUpload("family_document", { size: 20, type: "audio/webm" }, ebml("webm"))).toThrow();
      expect(() => validateUpload("student_photo", { size: 20, type: "audio/ogg" }, ogg)).toThrow();
      expect(() => validateUpload("voice_note", { size: png.length, type: "image/png" }, png)).toThrow();
    });
  });

  it("accepts the pieces a family sends: PDF and photos, 3 MB at most", () => {
    expect(validateUpload("family_document", { size: pdf.length, type: "application/pdf" }, pdf)).toBe("application/pdf");
    expect(validateUpload("family_document", { size: png.length, type: "image/png" }, png)).toBe("image/png");
    expect(() => validateUpload("family_document", { size: 3_000_001, type: "application/pdf" }, pdf)).toThrow("3 Mo");
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(() => validateUpload("family_document", { size: svg.length, type: "image/svg+xml" }, svg)).toThrow();
  });

  it("refuses an SVG logo carrying a script", () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" onload="x()"></svg>');
    expect(() => validateUpload("school_logo", { size: svg.length, type: "image/svg+xml" }, svg)).toThrow();
  });
});
