import { describe, expect, it } from "vitest";

import {
  actingInstitution,
  canCorrespond,
  departmentInstitution,
  departmentInstitutionId,
  institutionKey,
  institutionName,
  mailboxUsername,
  MINISTRY,
  parseDepartmentInstitutionId,
  parseInstitutionKey,
  parseMailboxUsername,
  partyOfAuthor,
  receipt,
  type Institution,
} from "./institutions";

// Department AQ: a direction without a chain (created before the chains),
// its DDEMP (AQ_P) and its DDESTFP (AQ_S); circonscriptions CAL and OUI;
// schools CEG (college) and EPP (primary) in CAL, OUID (primary) in OUI.
// Department LT: a direction without a chain, circonscription COT, LYC
// (secondary) in COT.
const I = {
  ministry: MINISTRY,
  AQ: { kind: "DEPARTMENT", id: "AQ", departmentId: "AQ", communeId: null, chain: null },
  AQ_P: departmentInstitution("AQ", "PRIMARY"),
  AQ_S: departmentInstitution("AQ", "SECONDARY"),
  LT: { kind: "DEPARTMENT", id: "LT", departmentId: "LT", communeId: null, chain: null },
  CAL: { kind: "COMMUNE", id: "CAL", departmentId: "AQ", communeId: "CAL", chain: "PRIMARY" },
  OUI: { kind: "COMMUNE", id: "OUI", departmentId: "AQ", communeId: "OUI", chain: "PRIMARY" },
  COT: { kind: "COMMUNE", id: "COT", departmentId: "LT", communeId: "COT", chain: "PRIMARY" },
  CEG: { kind: "SCHOOL", id: "CEG", departmentId: "AQ", communeId: "CAL", chain: "SECONDARY" },
  EPP: { kind: "SCHOOL", id: "EPP", departmentId: "AQ", communeId: "CAL", chain: "PRIMARY" },
  OUID: { kind: "SCHOOL", id: "OUID", departmentId: "AQ", communeId: "OUI", chain: "PRIMARY" },
  LYC: { kind: "SCHOOL", id: "LYC", departmentId: "LT", communeId: "COT", chain: "SECONDARY" },
} satisfies Record<string, Institution>;
type Name = keyof typeof I;
const NAMES = Object.keys(I) as Name[];

// Who may write to whom, by hand from the owner's routes and the two chains:
// the DDESTFP and the circonscriptions never meet, a circonscription never
// writes to a college.
const ROUTES: Record<Name, Name[]> = {
  ministry: ["AQ", "AQ_P", "AQ_S", "LT", "CAL", "OUI", "COT", "CEG", "EPP", "OUID", "LYC"],
  AQ: ["ministry", "CAL", "OUI", "CEG", "EPP", "OUID"],
  AQ_P: ["ministry", "CAL", "OUI", "EPP", "OUID"],
  AQ_S: ["ministry", "CEG"],
  LT: ["ministry", "COT", "LYC"],
  CAL: ["ministry", "AQ", "AQ_P", "EPP"],
  OUI: ["ministry", "AQ", "AQ_P", "OUID"],
  COT: ["ministry", "LT"],
  CEG: ["ministry", "AQ", "AQ_S", "EPP", "OUID", "LYC"],
  EPP: ["ministry", "AQ", "AQ_P", "CAL", "CEG", "OUID", "LYC"],
  OUID: ["ministry", "AQ", "AQ_P", "OUI", "CEG", "EPP", "LYC"],
  LYC: ["ministry", "LT", "CEG", "EPP", "OUID"],
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
  const staff = { departmentId: "AQ", communeId: "CAL", schoolId: "CEG", schoolCycle: "SECONDARY", isTeacher: false, canViewMessages: true } as const;
  it.each([
    ["NATIONAL", staff, MINISTRY],
    ["DEPARTMENT", staff, I.AQ],
    ["DEPARTMENT", { ...staff, chain: "PRIMARY" }, I.AQ_P],
    ["DEPARTMENT", { ...staff, chain: "SECONDARY" }, I.AQ_S],
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
    expect(parseInstitutionKey(institutionKey(I.AQ_S))).toEqual({ kind: "DEPARTMENT", id: "AQ_ESTFP" });
  });
  it("encodes the chain of a direction in its identifier", () => {
    const id = "0b9f3c2e-4a1d-4a57-9d0e-6f1b2c3d4e5f";
    expect(departmentInstitutionId(id, "PRIMARY")).toBe(`${id}_EMP`);
    expect(parseDepartmentInstitutionId(`${id}_ESTFP`)).toEqual({ departmentId: id, chain: "SECONDARY" });
    expect(parseDepartmentInstitutionId(id)).toEqual({ departmentId: id, chain: null });
    // A uuid department with its chain still makes a valid mailbox.
    expect(parseMailboxUsername(mailboxUsername(departmentInstitution(id, "SECONDARY")))).toEqual({ kind: "DEPARTMENT", id: `${id}_ESTFP` });
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
    ["MINISTRY", null, "Ministères en charge de l'éducation"],
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
  it("names a direction by its chain", () => {
    expect(institutionName("DEPARTMENT", "Atlantique", "PRIMARY")).toBe("DDEMP de l'Atlantique");
    expect(institutionName("DEPARTMENT", "Borgou", "SECONDARY")).toBe("DDESTFP du Borgou");
  });
});

describe("partyOfAuthor", () => {
  const parties = [I.CAL, I.CEG];
  it("finds the side an author writes for", () => {
    expect(partyOfAuthor({ level: "SCHOOL", departmentId: "AQ", communeId: "CAL", schoolId: "CEG" }, parties)).toEqual(I.CEG);
    expect(partyOfAuthor({ level: "COMMUNE", departmentId: "AQ", communeId: "CAL", schoolId: null }, parties)).toEqual(I.CAL);
    expect(partyOfAuthor({ level: "DEPARTMENT", departmentId: "AQ", communeId: null, schoolId: null, chain: "SECONDARY" }, [I.AQ_S, I.CEG])).toEqual(I.AQ_S);
    expect(partyOfAuthor({ level: "DEPARTMENT", departmentId: "AQ", communeId: null, schoolId: null, chain: "PRIMARY" }, [I.AQ_S, I.CEG])).toBeNull();
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
