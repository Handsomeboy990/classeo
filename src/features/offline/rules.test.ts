import { describe, expect, it } from "vitest";

import { attendanceConflicts, gradeConflicts, listNames, outcomeOfExisting } from "./rules";
import type { GradeCell } from "./types";

const cell = (value: number | null, over: Partial<GradeCell> = {}): GradeCell => ({ enrollmentId: "e1", type: "INTERROGATION", sequence: 1, value, ...over });
const server = (value: number, over: Partial<Omit<GradeCell, "value">> = {}) => ({ enrollmentId: "e1", type: "INTERROGATION", sequence: 1, ...over, value });

describe("gradeConflicts", () => {
  it("applies when the server still holds what the device read", () => {
    expect(gradeConflicts([server(8)], [cell(8)], [cell(14)])).toEqual([]);
  });

  it("applies a new grade on an empty cell that stayed empty", () => {
    expect(gradeConflicts([], [cell(null)], [cell(12)])).toEqual([]);
  });

  it("refuses when someone else changed the cell since it was read", () => {
    expect(gradeConflicts([server(10)], [cell(8)], [cell(14)])).toEqual([cell(14)]);
  });

  it("refuses when a grade appeared on a cell read empty", () => {
    expect(gradeConflicts([server(11)], [cell(null)], [cell(14)])).toHaveLength(1);
  });

  it("refuses clearing a cell that someone else filled", () => {
    expect(gradeConflicts([server(11)], [cell(null)], [cell(null)])).toHaveLength(1);
    expect(gradeConflicts([server(11)], [cell(9)], [cell(null)])).toHaveLength(1);
  });

  it("accepts when both sides already agree (an earlier attempt landed)", () => {
    expect(gradeConflicts([server(14)], [cell(8)], [cell(14)])).toEqual([]);
    expect(gradeConflicts([server(12.5)], [cell(8)], [cell(12.5)])).toEqual([]);
  });

  it("treats a cell without baseline as a conflict only when the server differs", () => {
    expect(gradeConflicts([], null, [cell(12)])).toEqual([]);
    expect(gradeConflicts([server(9)], null, [cell(12)])).toHaveLength(1);
  });

  it("keys cells by student, evaluation and sequence", () => {
    const next = [cell(12, { sequence: 2 }), cell(13, { type: "DEVOIR" })];
    expect(gradeConflicts([server(5, { sequence: 1 })], [cell(5, { sequence: 1 })], next)).toEqual([]);
  });
});

describe("attendanceConflicts", () => {
  const rec = (status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED", reason = "") => ({ enrollmentId: "e1", status, reason });

  it("applies on a register not yet taken", () => {
    expect(attendanceConflicts([], [{ enrollmentId: "e1", status: null, reason: "" }], [rec("ABSENT")])).toEqual([]);
  });

  it("refuses when someone took the register after the device read it", () => {
    expect(attendanceConflicts([{ enrollmentId: "e1", status: "PRESENT", reason: null }], [{ enrollmentId: "e1", status: null, reason: "" }], [rec("ABSENT")])).toHaveLength(1);
  });

  it("applies over an unchanged record", () => {
    expect(attendanceConflicts([{ enrollmentId: "e1", status: "PRESENT", reason: null }], [{ enrollmentId: "e1", status: "PRESENT", reason: "" }], [rec("ABSENT")])).toEqual([]);
  });

  it("accepts identical marks and ignores the reason of a present student", () => {
    expect(attendanceConflicts([{ enrollmentId: "e1", status: "ABSENT", reason: "Malade" }], [{ enrollmentId: "e1", status: null, reason: "" }], [rec("ABSENT", " Malade ")])).toEqual([]);
    expect(attendanceConflicts([{ enrollmentId: "e1", status: "PRESENT", reason: "x" }], [], [rec("PRESENT")])).toEqual([]);
  });

  it("sees a changed reason as a change", () => {
    expect(attendanceConflicts([{ enrollmentId: "e1", status: "ABSENT", reason: "Malade" }], [{ enrollmentId: "e1", status: "ABSENT", reason: "" }], [rec("ABSENT", "Voyage")])).toHaveLength(1);
  });
});

describe("outcomeOfExisting", () => {
  const now = new Date("2026-09-25T10:00:00Z");
  const row = (status: string, over: Partial<{ userId: string; error: string | null; createdAt: Date }> = {}) => ({
    userId: "u1",
    status,
    error: null,
    createdAt: new Date("2026-09-25T09:59:30Z"),
    ...over,
  });

  it("lets a new identifier through", () => expect(outcomeOfExisting(null, "u1", now)).toBeNull());
  it("answers an applied entry without writing again", () => expect(outcomeOfExisting(row("applied"), "u1", now)).toMatchObject({ outcome: "applied", duplicate: true }));
  it("repeats a refusal", () => expect(outcomeOfExisting(row("rejected", { error: "Fiche verrouillée" }), "u1", now)).toEqual({ outcome: "rejected", reason: "Fiche verrouillée" }));
  it("never serves another account's entry", () => expect(outcomeOfExisting(row("applied", { userId: "u2" }), "u1", now)).toMatchObject({ outcome: "rejected" }));
  it("waits while another request writes it", () => expect(outcomeOfExisting(row("processing"), "u1", now)).toMatchObject({ outcome: "retry" }));
  it("takes over a claim left behind", () => expect(outcomeOfExisting(row("processing", { createdAt: new Date("2026-09-25T09:50:00Z") }), "u1", now)).toBeNull());
});

describe("listNames", () => {
  it("joins in French", () => {
    expect(listNames(["A"])).toBe("A");
    expect(listNames(["A", "B"])).toBe("A et B");
    expect(listNames(["A", "B", "C", "D", "E"])).toBe("A, B, C et 2 autres");
  });
});
