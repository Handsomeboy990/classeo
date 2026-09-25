import { describe, expect, it } from "vitest";

import { normalizeSubjectCode, SUBJECT_CODE } from "./labels";

describe("subject codes", () => {
  it("normalises what is typed into a catalogue code", () => {
    expect(normalizeSubjectCode(" svt ")).toBe("SVT");
    expect(normalizeSubjectCode("éducation civique")).toBe("EDUCATION-CIVIQUE");
    expect(normalizeSubjectCode("p-fr")).toBe("P-FR");
  });
  it("accepts short codes and refuses anything else", () => {
    for (const ok of ["SVT", "P-FR", "INFO", "LV2"]) expect(SUBJECT_CODE.test(ok)).toBe(true);
    for (const bad of ["", "EDUCATION-CIVIQUE", "A--B", "FR_1", "<b>"]) expect(SUBJECT_CODE.test(bad)).toBe(false);
  });
});
