import { describe, expect, it } from "vitest";

import { directionFor, nextStatus, transferTimeline, type TimelineInput } from "./logic";

describe("nextStatus", () => {
  it("walks a school change through the guardian then the destination", () => {
    expect(nextStatus("SCHOOL_CHANGE", "PENDING_GUARDIAN", "guardian_approve")).toEqual({ ok: true, status: "PENDING_DESTINATION" });
    expect(nextStatus("SCHOOL_CHANGE", "PENDING_DESTINATION", "destination_accept")).toEqual({ ok: true, status: "ACCEPTED" });
    expect(nextStatus("SCHOOL_CHANGE", "PENDING_DESTINATION", "destination_refuse")).toEqual({ ok: true, status: "REJECTED" });
    expect(nextStatus("SCHOOL_CHANGE", "PENDING_GUARDIAN", "guardian_refuse")).toEqual({ ok: true, status: "REJECTED" });
  });

  it("refuses a destination decision before the guardian consented", () => {
    expect(nextStatus("SCHOOL_CHANGE", "PENDING_GUARDIAN", "destination_accept").ok).toBe(false);
  });

  it("refuses a second answer and any change once decided", () => {
    expect(nextStatus("SCHOOL_CHANGE", "PENDING_DESTINATION", "guardian_approve").ok).toBe(false);
    for (const status of ["ACCEPTED", "REJECTED", "CANCELLED"] as const) {
      expect(nextStatus("SCHOOL_CHANGE", status, "cancel").ok).toBe(false);
      expect(nextStatus("SCHOOL_CHANGE", status, "destination_accept").ok).toBe(false);
      expect(nextStatus("SCHOOL_CHANGE", status, "guardian_approve").ok).toBe(false);
    }
  });

  it("lets the origin cancel while pending", () => {
    expect(nextStatus("SCHOOL_CHANGE", "PENDING_GUARDIAN", "cancel")).toEqual({ ok: true, status: "CANCELLED" });
    expect(nextStatus("SCHOOL_CHANGE", "PENDING_DESTINATION", "cancel")).toEqual({ ok: true, status: "CANCELLED" });
  });

  it("has nothing to validate on a class change", () => {
    expect(nextStatus("CLASS_CHANGE", "ACCEPTED", "cancel").ok).toBe(false);
  });
});

const base: TimelineInput = {
  kind: "SCHOOL_CHANGE",
  status: "PENDING_GUARDIAN",
  createdAt: new Date("2026-10-01T08:00:00Z"),
  requestedBy: { name: "Florentin Agossou", role: "Chef d'établissement" },
  fromSchool: "CEG Godomey",
  fromClassroom: "4e A",
  toSchool: "CEG Abomey-Calavi",
  toClassroom: null,
  guardianDecidedAt: null,
  guardianDecisionBy: null,
  guardianRecordedByStaff: false,
  decidedAt: null,
  decidedBy: null,
  decisionNote: null,
};

describe("transferTimeline", () => {
  it("shows the guardian step as current, then the destination ahead", () => {
    const steps = transferTimeline(base);
    expect(steps.map((s) => [s.key, s.tone])).toEqual([
      ["created", "done"],
      ["guardian", "current"],
      ["destination", "upcoming"],
    ]);
  });

  it("stops at a guardian refusal", () => {
    const steps = transferTimeline({ ...base, status: "REJECTED", guardianDecidedAt: new Date("2026-10-02T08:00:00Z"), decisionNote: "Nous restons à Godomey" });
    expect(steps.map((s) => s.key)).toEqual(["created", "guardian"]);
    expect(steps[1]!.tone).toBe("refused");
    expect(steps[1]!.detail).toContain("Nous restons à Godomey");
  });

  it("ends with the accepted class", () => {
    const steps = transferTimeline({
      ...base,
      status: "ACCEPTED",
      guardianDecidedAt: new Date("2026-10-02T08:00:00Z"),
      guardianRecordedByStaff: true,
      decidedAt: new Date("2026-10-03T08:00:00Z"),
      toClassroom: "4e B",
    });
    expect(steps[1]!.title).toBe("Accord du parent recueilli par l'établissement");
    expect(steps[2]!.title).toBe("Accepté par CEG Abomey-Calavi, en 4e B");
    expect(steps[2]!.tone).toBe("done");
  });

  it("tells a cancellation", () => {
    const steps = transferTimeline({ ...base, status: "CANCELLED", decidedAt: new Date("2026-10-02T08:00:00Z") });
    expect(steps.at(-1)!.key).toBe("cancelled");
  });
});

describe("directionFor", () => {
  it("places a transfer in the outgoing or incoming tab", () => {
    const t = { fromSchoolId: "a", toSchoolId: "b" };
    expect(directionFor("a", t)).toBe("outgoing");
    expect(directionFor("b", t)).toBe("incoming");
    expect(directionFor("c", t)).toBeNull();
    expect(directionFor("a", { fromSchoolId: "a", toSchoolId: "a" })).toBe("internal");
  });
});
