import { describe, expect, it } from "vitest";

import { appointmentStatus, creatableStatuses, payerOf } from "./teacher-status";

describe("teacher payer", () => {
  it("has the State pay its agents and the school the others", () => {
    expect(payerOf("APE")).toBe("STATE");
    expect(payerOf("ACE")).toBe("STATE");
    expect(payerOf("AME")).toBe("STATE");
    expect(payerOf("VACATAIRE")).toBe("SCHOOL");
    expect(payerOf("PRIVATE")).toBe("SCHOOL");
    expect(payerOf(null)).toBeNull();
  });
});

describe("appointment status", () => {
  it("keeps the registry status of a State agent appointed in a public school", () => {
    expect(appointmentStatus({ chosen: null, stateStatus: "APE", sector: "PUBLIC" })).toEqual({ ok: true, status: "APE" });
    expect(appointmentStatus({ chosen: "VACATAIRE", stateStatus: "ACE", sector: "PUBLIC" })).toEqual({ ok: true, status: "ACE" });
  });

  it("makes a State agent a vacataire in a private school", () => {
    expect(appointmentStatus({ chosen: "VACATAIRE", stateStatus: "APE", sector: "PRIVATE" })).toEqual({ ok: true, status: "VACATAIRE" });
  });

  it("never lets a school create a State agent", () => {
    const r = appointmentStatus({ chosen: "APE", stateStatus: null, sector: "PUBLIC" });
    expect(r.ok).toBe(false);
    expect(appointmentStatus({ chosen: "AME", stateStatus: null, sector: "CONFESSIONAL" }).ok).toBe(false);
  });

  it("lets a public school hire vacataires only, a private school its own teachers too", () => {
    expect(creatableStatuses("PUBLIC")).toEqual(["VACATAIRE"]);
    expect(creatableStatuses("PRIVATE")).toEqual(["PRIVATE", "VACATAIRE"]);
    expect(appointmentStatus({ chosen: "PRIVATE", stateStatus: null, sector: "PUBLIC" }).ok).toBe(false);
    expect(appointmentStatus({ chosen: null, stateStatus: null, sector: "PUBLIC" })).toEqual({ ok: true, status: "VACATAIRE" });
    expect(appointmentStatus({ chosen: null, stateStatus: null, sector: "PRIVATE" })).toEqual({ ok: true, status: "PRIVATE" });
  });
});
