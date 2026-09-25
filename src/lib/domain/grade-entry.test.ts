import { describe, expect, it } from "vitest";

import { evaluationColumns, parseGradeValue, sheetProgress } from "./grade-entry";

describe("evaluationColumns", () => {
  it("lists interrogations, devoirs then compositions", () => {
    const cols = evaluationColumns({ interrogationCount: 2, devoirCount: 1, compositionCount: 1 });
    expect(cols.map((c) => c.short)).toEqual(["I1", "I2", "D", "C"]);
    expect(cols.map((c) => c.label)).toEqual(["Interrogation 1", "Interrogation 2", "Devoir", "Composition"]);
    expect(cols[0]).toMatchObject({ key: "INTERROGATION:1", type: "INTERROGATION", sequence: 1 });
  });

  it("numbers a single interrogation and repeated devoirs", () => {
    const cols = evaluationColumns({ interrogationCount: 1, devoirCount: 2, compositionCount: 0 });
    expect(cols.map((c) => c.short)).toEqual(["I1", "D1", "D2"]);
  });
});

describe("parseGradeValue", () => {
  it("accepts empty cells as no grade", () => {
    expect(parseGradeValue("  ")).toEqual({ ok: true, value: null });
  });

  it("reads a comma or a dot as decimal separator", () => {
    expect(parseGradeValue("12,5")).toEqual({ ok: true, value: 12.5 });
    expect(parseGradeValue("7.25")).toEqual({ ok: true, value: 7.25 });
    expect(parseGradeValue("0")).toEqual({ ok: true, value: 0 });
    expect(parseGradeValue("20")).toEqual({ ok: true, value: 20 });
  });

  it("rejects values outside 0 to 20 and malformed input", () => {
    expect(parseGradeValue("21").ok).toBe(false);
    expect(parseGradeValue("-1").ok).toBe(false);
    expect(parseGradeValue("abc").ok).toBe(false);
    expect(parseGradeValue("12,555").ok).toBe(false);
    expect(parseGradeValue("100").ok).toBe(false);
  });
});

describe("sheetProgress", () => {
  it("is the share of expected grades entered", () => {
    expect(sheetProgress(30, 20, 3)).toBe(0.5);
    expect(sheetProgress(0, 0, 4)).toBe(0);
    expect(sheetProgress(90, 20, 4)).toBe(1);
  });
});
