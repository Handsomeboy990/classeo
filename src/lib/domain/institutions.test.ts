import { describe, expect, it } from "vitest";

import {
  actingInstitution,
  canCorrespond,
  institutionKey,
  institutionName,
  mailboxUsername,
  MINISTRY,
  parseInstitutionKey,
  parseMailboxUsername,
  partyOfAuthor,
  receipt,
  type Institution,
} from "./institutions";

// Department AQ > districts CAL and OUI > schools CEG, EPP (CAL) and OUID (OUI);
// department LT > district COT > school LYC.
const I = {
  ministry: MINISTRY,
  AQ: { kind: "DEPARTMENT", id: "AQ", departmentId: "AQ", communeId: null },
  LT: { kind: "DEPARTMENT", id: "LT", departmentId: "LT", communeId: null },
  CAL: { kind: "COMMUNE", id: "CAL", departmentId: "AQ", communeId: "CAL" },
  OUI: { kind: "COMMUNE", id: "OUI", departmentId: "AQ", communeId: "OUI" },
  COT: { kind: "COMMUNE", id: "COT", departmentId: "LT", communeId: "COT" },
  CEG: { kind: "SCHOOL", id: "CEG", departmentId: "AQ", communeId: "CAL" },
  EPP: { kind: "SCHOOL", id: "EPP", departmentId: "AQ", communeId: "CAL" },
  OUID: { kind: "SCHOOL", id: "OUID", departmentId: "AQ", communeId: "OUI" },
  LYC: { kind: "SCHOOL", id: "LYC", departmentId: "LT", communeId: "COT" },
} satisfies Record<string, Institution>;
type Name = keyof typeof I;
const NAMES = Object.keys(I) as Name[];

// Who may write to whom, by hand from the owner's routes.
const ROUTES: Record<Name, Name[]> = {
  ministry: ["AQ", "LT", "CAL", "OUI", "COT", "CEG", "EPP", "OUID", "LYC"],
  AQ: ["ministry", "CAL", "OUI", "CEG", "EPP", "OUID"],
  LT: ["ministry", "COT", "LYC"],
  CAL: ["ministry", "AQ", "CEG", "EPP"],
  OUI: ["ministry", "AQ", "OUID"],
  COT: ["ministry", "LT", "LYC"],
  CEG: ["ministry", "AQ", "CAL", "EPP", "OUID", "LYC"],
  EPP: ["ministry", "AQ", "CAL", "CEG", "OUID", "LYC"],
  OUID: ["ministry", "AQ", "OUI", "CEG", "EPP", "LYC"],
  LYC: ["ministry", "LT", "COT", "CEG", "EPP", "OUID"],
};

describe("canCorrespond", () => {
  const cases = NAMES.flatMap((from) => NAMES.map((to) => ({ from, to, expected: ROUTES[from].includes(to) })));
  it.each(cases)("$from to $to: $expected", ({ from, to, expected }) => {
    expect(canCorrespond(I[from], I[to])).toBe(expected);
  });
  it("is the same both ways", () => {
    for (const a of NAMES) for (const b of NAMES) expect(canCorrespond(I[a], I[b])).toBe(canCorrespond(I[b], I[a]));
  });
});

describe("actingInstitution", () => {
  const staff = { departmentId: "AQ", communeId: "CAL", schoolId: "CEG", isTeacher: false, canViewMessages: true };
  it.each([
    ["NATIONAL", staff, MINISTRY],
    ["DEPARTMENT", staff, I.AQ],
    ["COMMUNE", staff, I.CAL],
    ["SCHOOL", staff, I.CEG],
    ["SCHOOL", { ...staff, isTeacher: true }, null],
    ["SCHOOL", { ...staff, canViewMessages: false }, null],
    ["SCHOOL", { ...staff, schoolId: null }, null],
    ["DEPARTMENT", { ...staff, departmentId: null }, null],
    ["SELF", staff, null],
  ] as const)("%s %j", (level, p, expected) => {
    expect(actingInstitution({ level, ...p })).toEqual(expected);
  });
});

describe("identifiers", () => {
  it("round trips mailbox usernames and picker keys", () => {
    expect(parseMailboxUsername(mailboxUsername(I.CEG))).toEqual({ kind: "SCHOOL", id: "CEG" });
    expect(parseMailboxUsername(mailboxUsername(MINISTRY))).toEqual({ kind: "MINISTRY", id: "nation" });
    expect(parseInstitutionKey(institutionKey(I.AQ))).toEqual({ kind: "DEPARTMENT", id: "AQ" });
  });
  it("never mistakes a person for a mailbox", () => {
    expect(parseMailboxUsername("florentin.agossou")).toBeNull();
    expect(parseMailboxUsername("institution.school")).toBeNull();
    expect(parseMailboxUsername("institution.planet.x")).toBeNull();
  });
  it("rejects malformed keys", () => {
    expect(parseInstitutionKey("MINISTRY:AQ")).toBeNull();
    expect(parseInstitutionKey("SCHOOL:nation")).toBeNull();
    expect(parseInstitutionKey("SCHOOL:")).toBeNull();
    expect(parseInstitutionKey("SCHOOL:a:b")).toBeNull();
  });
});

describe("institutionName", () => {
  it.each([
    ["MINISTRY", null, "Ministère des Enseignements"],
    ["DEPARTMENT", "Atlantique", "Direction départementale de l'Atlantique"],
    ["DEPARTMENT", "Borgou", "Direction départementale du Borgou"],
    ["DEPARTMENT", "Collines", "Direction départementale des Collines"],
    ["DEPARTMENT", "Donga", "Direction départementale de la Donga"],
    ["COMMUNE", "Abomey-Calavi", "Circonscription scolaire d'Abomey-Calavi"],
    ["COMMUNE", "Ouidah", "Circonscription scolaire d'Ouidah"],
    ["COMMUNE", "Cotonou", "Circonscription scolaire de Cotonou"],
    ["SCHOOL", "CEG Godomey", "CEG Godomey"],
  ] as const)("%s %s", (kind, name, expected) => {
    expect(institutionName(kind, name)).toBe(expected);
  });
});

describe("partyOfAuthor", () => {
  const parties = [I.CAL, I.CEG];
  it("finds the side an author writes for", () => {
    expect(partyOfAuthor({ level: "SCHOOL", departmentId: "AQ", communeId: "CAL", schoolId: "CEG" }, parties)).toEqual(I.CEG);
    expect(partyOfAuthor({ level: "COMMUNE", departmentId: "AQ", communeId: "CAL", schoolId: null }, parties)).toEqual(I.CAL);
  });
  it("finds nothing for an outsider", () => {
    expect(partyOfAuthor({ level: "SCHOOL", departmentId: "AQ", communeId: "CAL", schoolId: "EPP" }, parties)).toBeNull();
    expect(partyOfAuthor({ level: "SELF", departmentId: null, communeId: null, schoolId: null }, parties)).toBeNull();
  });
});

describe("receipt", () => {
  const at = (iso: string) => new Date(iso);
  it("is read once the party opened the thread after the message", () => {
    expect(receipt(at("2026-09-24T10:00:00Z"), at("2026-09-24T11:00:00Z"))).toBe("read");
    expect(receipt(at("2026-09-24T10:00:00Z"), at("2026-09-24T10:00:00Z"))).toBe("read");
  });
  it("is unread before, and nothing without a message", () => {
    expect(receipt(at("2026-09-24T10:00:00Z"), at("2026-09-24T09:00:00Z"))).toBe("unread");
    expect(receipt(at("2026-09-24T10:00:00Z"), null)).toBe("unread");
    expect(receipt(null, null)).toBeNull();
  });
});
