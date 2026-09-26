import { describe, expect, it } from "vitest";

import { contentDisposition, parseRange } from "./http-files";

describe("contentDisposition", () => {
  it("keeps a plain name and encodes accents in the extended form", () => {
    expect(contentDisposition("acte.pdf", "attachment")).toBe(`attachment; filename="acte.pdf"; filename*=UTF-8''acte.pdf`);
    expect(contentDisposition("Acte de naissance é.pdf", "inline")).toBe(`inline; filename="Acte de naissance e.pdf"; filename*=UTF-8''Acte%20de%20naissance%20%C3%A9.pdf`);
  });
  it("drops quotes, paths and control characters that could break the header", () => {
    const header = contentDisposition('../../etc/pa"ss\r\nX-Evil: 1.pdf', "attachment");
    expect(header).not.toMatch(/[\r\n]/);
    expect(header).not.toContain("..");
    expect(header.split('"').length).toBe(3);
  });
  it("falls back to a neutral name", () => {
    expect(contentDisposition("", "inline")).toContain('filename="fichier"');
  });
});

describe("parseRange", () => {
  it("reads a start, a start and an end, and a suffix", () => {
    expect(parseRange("bytes=0-", 100)).toEqual({ start: 0, end: 99 });
    expect(parseRange("bytes=10-19", 100)).toEqual({ start: 10, end: 19 });
    expect(parseRange("bytes=90-500", 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
  });
  it("answers the whole file without a usable single range", () => {
    expect(parseRange(null, 100)).toBeNull();
    expect(parseRange("bytes=0-1,5-9", 100)).toBeNull();
    expect(parseRange("items=0-5", 100)).toBeNull();
  });
  it("refuses a range outside the file", () => {
    expect(parseRange("bytes=100-", 100)).toBe("invalid");
    expect(parseRange("bytes=20-10", 100)).toBe("invalid");
    expect(parseRange("bytes=-0", 100)).toBe("invalid");
  });
});
