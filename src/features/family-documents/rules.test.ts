import { describe, expect, it } from "vitest";

import { ageOn, canSendAgain, dispensationActive, dropsFileOnDecision, familyMayRead, isHealthDoc, periodError, refusalToSend, reviewPermission } from "./rules";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const parent = { guardianId: "g1", studentId: null };
const student = { guardianId: null, studentId: "s1" };

describe("ageOn", () => {
  it("counts whole years, the birthday itself included", () => {
    expect(ageOn(d("2010-09-26"), d("2026-09-25"))).toBe(15);
    expect(ageOn(d("2010-09-26"), d("2026-09-26"))).toBe(16);
    expect(ageOn(d("2010-02-28"), d("2026-03-01"))).toBe(16);
  });
});

describe("refusalToSend", () => {
  const today = d("2026-09-26");
  const sixteen = { birthDate: d("2010-01-10") };
  const fifteen = { birthDate: d("2011-01-10") };
  it("lets a parent send any piece", () => {
    expect(refusalToSend(parent, { health: true }, fifteen, today)).toBeNull();
    expect(refusalToSend(parent, { health: false }, fifteen, today)).toBeNull();
  });
  it("lets a student of 16 or more send pieces that are not health pieces", () => {
    expect(refusalToSend(student, { health: false }, sixteen, today)).toBeNull();
    expect(refusalToSend(student, { health: true }, sixteen, today)).toMatch(/parents/);
  });
  it("sends a younger student back to the parents", () => {
    expect(refusalToSend(student, { health: false }, fifteen, today)).toMatch(/16 ans/);
  });
  it("refuses an account that is neither parent nor student", () => {
    expect(refusalToSend({ guardianId: null, studentId: null }, { health: false }, sixteen, today)).not.toBeNull();
  });
});

describe("health pieces", () => {
  it("covers medical certificates and pieces the school marked as health", () => {
    expect(isHealthDoc({ kind: "MEDICAL" })).toBe(true);
    expect(isHealthDoc({ kind: "ENROLLMENT", requiredPiece: { isHealth: true } })).toBe(true);
    expect(isHealthDoc({ kind: "ENROLLMENT", requiredPiece: { isHealth: false } })).toBe(false);
    expect(isHealthDoc({ kind: "ABSENCE" })).toBe(false);
  });
  it("need the health right to be decided and lose their file once decided", () => {
    expect(reviewPermission({ health: true })).toBe("health_document:approve");
    expect(reviewPermission({ health: false })).toBe("family_document:approve");
    expect(dropsFileOnDecision({ health: true })).toBe(true);
    expect(dropsFileOnDecision({ health: false })).toBe(false);
  });
  it("are read by the parents, never by the student", () => {
    expect(familyMayRead(parent, { health: true })).toBe(true);
    expect(familyMayRead(student, { health: true })).toBe(false);
    expect(familyMayRead(student, { health: false })).toBe(true);
    expect(familyMayRead({ guardianId: null, studentId: null }, { health: false })).toBe(false);
  });
});

describe("canSendAgain", () => {
  it("waits while a piece is examined or once it is accepted, and reopens after a refusal", () => {
    expect(canSendAgain([])).toBe(true);
    expect(canSendAgain([{ status: "REJECTED" }])).toBe(true);
    expect(canSendAgain([{ status: "REJECTED" }, { status: "PENDING" }])).toBe(false);
    expect(canSendAgain([{ status: "ACCEPTED" }])).toBe(false);
  });
});

describe("dispensation period", () => {
  it("accepts a period of one day or more, one year at most", () => {
    expect(periodError("2026-10-01", "2026-10-01")).toBeNull();
    expect(periodError("2026-10-01", "2026-09-30")).toMatch(/après/);
    expect(periodError("2026-09-01", "2027-09-30")).toMatch(/année/);
    expect(periodError("", "2026-10-01")).not.toBeNull();
  });
  it("is in force on the days of an accepted period only", () => {
    const disp = { status: "ACCEPTED" as const, startsOn: d("2026-10-01"), endsOn: d("2026-10-31") };
    expect(dispensationActive(disp, new Date("2026-10-01T15:00:00Z"))).toBe(true);
    expect(dispensationActive(disp, d("2026-10-31"))).toBe(true);
    expect(dispensationActive(disp, d("2026-11-01"))).toBe(false);
    expect(dispensationActive({ ...disp, status: "PENDING" }, d("2026-10-10"))).toBe(false);
  });
});
