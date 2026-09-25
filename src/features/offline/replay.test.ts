import { describe, expect, it, vi } from "vitest";

import { NO_PERMISSION, replay, type ReplayDeps, type ReplayUser } from "./replay";
import type { SubmissionRow } from "./rules";
import type { ReplayRequest } from "./types";

const CLIENT = "6f1c2b8e-0d7a-4c55-9a51-2f3c9e7b1a00";

const teacher: ReplayUser = { id: "u1", mustChangePassword: false, permissions: new Set(["grade:update", "attendance:create", "message:create"]) };

function gradesRequest(over: Partial<ReplayRequest> = {}): ReplayRequest {
  return {
    clientId: CLIENT,
    userId: "u1",
    kind: "grades",
    payload: { sheetId: "s1", cells: [{ enrollmentId: "e1", type: "COMPOSITION", sequence: 1, value: 14 }] },
    baseline: { cells: [{ enrollmentId: "e1", type: "COMPOSITION", sequence: 1, value: 8 }] },
    createdAt: 1,
    ...over,
  };
}

function deps(over: Partial<ReplayDeps> = {}) {
  const rows = new Map<string, SubmissionRow>();
  const d = {
    findSubmission: vi.fn(async (id: string) => rows.get(id) ?? null),
    recordRejected: vi.fn(async (userId: string, id: string, _kind: string, reason: string) => {
      rows.set(id, { userId, status: "rejected", error: reason, createdAt: new Date() });
    }),
    assertWritable: vi.fn(async () => undefined),
    loadGradeTarget: vi.fn(async () => ({ schoolId: "sc", academicYearId: "y", grades: [{ enrollmentId: "e1", type: "COMPOSITION", sequence: 1, value: 8 }], names: new Map([["e1", "Aïcha Dossou"]]) })),
    loadAttendanceTarget: vi.fn(async () => ({ schoolId: "sc", academicYearId: "y", records: [], names: new Map() })),
    runAction: vi.fn(async () => ({ ok: true, message: "1 note enregistrée." })),
    ...over,
  };
  return { d, rows };
}

describe("replay", () => {
  it("asks to sign in without a session, and never writes", async () => {
    const { d } = deps();
    expect(await replay(gradesRequest(), null, d)).toEqual({ outcome: "auth" });
    expect(await replay(gradesRequest(), { ...teacher, mustChangePassword: true }, d)).toEqual({ outcome: "auth" });
    expect(d.runAction).not.toHaveBeenCalled();
  });

  it("keeps an entry of another account sealed", async () => {
    const { d } = deps();
    expect(await replay(gradesRequest({ userId: "u2" }), teacher, d)).toEqual({ outcome: "other-user" });
    expect(d.runAction).not.toHaveBeenCalled();
    expect(d.recordRejected).not.toHaveBeenCalled();
  });

  it("applies through the online action, with the identifier", async () => {
    const { d } = deps();
    expect(await replay(gradesRequest(), teacher, d)).toEqual({ outcome: "applied", message: "1 note enregistrée." });
    expect(d.assertWritable).toHaveBeenCalledWith(expect.objectContaining({ schoolId: "sc", academicYearId: "y" }));
    expect(d.runAction).toHaveBeenCalledWith("grades", expect.objectContaining({ sheetId: "s1", clientId: CLIENT }));
  });

  it("answers a replay of an applied entry without writing twice", async () => {
    const { d, rows } = deps();
    rows.set(CLIENT, { userId: "u1", status: "applied", error: null, createdAt: new Date() });
    expect(await replay(gradesRequest(), teacher, d)).toMatchObject({ outcome: "applied", duplicate: true });
    expect(d.runAction).not.toHaveBeenCalled();
  });

  it("refuses without the permission of the online action", async () => {
    const { d, rows } = deps();
    const outcome = await replay(gradesRequest(), { ...teacher, permissions: new Set(["message:create"]) }, d);
    expect(outcome).toEqual({ outcome: "rejected", reason: NO_PERMISSION });
    expect(rows.get(CLIENT)?.status).toBe("rejected");
    expect(d.runAction).not.toHaveBeenCalled();
  });

  it("refuses a write on a closed school or year", async () => {
    const closed = Object.assign(new Error("L'année scolaire 2025-2026 est close."), { name: "DomainError" });
    const { d } = deps({ assertWritable: vi.fn(async () => Promise.reject(closed)) });
    expect(await replay(gradesRequest(), teacher, d)).toEqual({ outcome: "rejected", reason: "L'année scolaire 2025-2026 est close." });
    expect(d.runAction).not.toHaveBeenCalled();
  });

  it("refuses a grade changed by someone else and names the student", async () => {
    const { d } = deps({
      loadGradeTarget: vi.fn(async () => ({ schoolId: "sc", academicYearId: "y", grades: [{ enrollmentId: "e1", type: "COMPOSITION", sequence: 1, value: 11 }], names: new Map([["e1", "Aïcha Dossou"]]) })),
    });
    const outcome = await replay(gradesRequest(), teacher, d);
    expect(outcome.outcome).toBe("rejected");
    expect(outcome.outcome === "rejected" && outcome.reason).toContain("Aïcha Dossou");
    expect(d.runAction).not.toHaveBeenCalled();
  });

  it("refuses a register taken by someone else in the meantime", async () => {
    const { d } = deps({
      loadAttendanceTarget: vi.fn(async () => ({ schoolId: "sc", academicYearId: "y", records: [{ enrollmentId: "e1", status: "PRESENT" as const, reason: null }], names: new Map([["e1", "Koffi Mensah"]]) })),
    });
    const request: ReplayRequest = {
      ...gradesRequest(),
      kind: "attendance",
      payload: { classroomId: "c1", date: "2026-09-25", half: "MORNING", records: [{ enrollmentId: "e1", status: "ABSENT", reason: "" }] },
      baseline: { records: [{ enrollmentId: "e1", status: null, reason: "" }] },
    };
    const outcome = await replay(request, teacher, d);
    expect(outcome.outcome === "rejected" && outcome.reason).toContain("Koffi Mensah");
  });

  it("returns the refusal the action recorded", async () => {
    const { d, rows } = deps({
      runAction: vi.fn(async () => {
        rows.set(CLIENT, { userId: "u1", status: "rejected", error: "Cette fiche est verrouillée : les notes ne peuvent plus être modifiées.", createdAt: new Date() });
        return { ok: false, message: "Cette fiche est verrouillée : les notes ne peuvent plus être modifiées." };
      }),
    });
    expect(await replay(gradesRequest(), teacher, d)).toEqual({ outcome: "rejected", reason: "Cette fiche est verrouillée : les notes ne peuvent plus être modifiées." });
  });

  it("records a validation refusal of the action", async () => {
    const { d, rows } = deps({ runAction: vi.fn(async () => ({ ok: false, message: "Certains champs sont invalides.", fieldErrors: { cells: ["Une note est comprise entre 0 et 20."] } })) });
    const outcome = await replay(gradesRequest(), teacher, d);
    expect(outcome).toEqual({ outcome: "rejected", reason: "Certains champs sont invalides. Une note est comprise entre 0 et 20." });
    expect(rows.get(CLIENT)?.status).toBe("rejected");
  });

  it("keeps the entry queued after an unexpected failure", async () => {
    const { d, rows } = deps({ runAction: vi.fn(async () => ({ ok: false, message: "Une erreur inattendue est survenue." })) });
    expect((await replay(gradesRequest(), teacher, d)).outcome).toBe("retry");
    expect(rows.has(CLIENT)).toBe(false);
  });

  it("sends a message without conflict checks", async () => {
    const { d } = deps();
    const request: ReplayRequest = { ...gradesRequest(), kind: "message", payload: { conversationId: "c1", body: "Bonjour" }, baseline: null };
    expect((await replay(request, teacher, d)).outcome).toBe("applied");
    expect(d.loadGradeTarget).not.toHaveBeenCalled();
    expect(d.assertWritable).not.toHaveBeenCalled();
  });
});
