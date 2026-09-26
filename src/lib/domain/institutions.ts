// Institutions as messaging parties. Pure, unit tested.
//
// The ministry, a departmental direction (DDEMP or DDESTFP), a circonscription
// scolaire and a school can write to one another, along the chain of the
// school's cycle (lib/domain/chains.ts). A circonscription is held here at
// the level of its commune. A conversation
// between institutions belongs to the institutions, not to the people: every
// authorised member of staff of an institution sees it, answers on its
// behalf, and each message still records the person who wrote it.
//
// Storage: each institution is represented in a conversation by a mailbox
// account, a user row that can never sign in (inactive, no password, a role
// without permissions), whose read marker is the institution's read receipt.

import { chainOfCycle, DIRECTION_OF, MINISTRIES_NAME, ofPlace, type Chain, type CycleCode } from "./chains";

export { ofPlace };

export type InstitutionKind = "MINISTRY" | "DEPARTMENT" | "COMMUNE" | "SCHOOL";

export type Institution = {
  kind: InstitutionKind;
  // The commune or school id, the department id followed by its chain for
  // a departmental direction ("<id>_EMP", "<id>_ESTFP"; the bare id for a
  // direction created before the chains); "nation" for the ministry.
  id: string;
  // Territory above the institution (itself for a department or a commune).
  departmentId: string | null;
  communeId: string | null;
  // The chain of a direction or of a school (from its cycle); a
  // circonscription is always PRIMARY. Null or absent: both chains.
  chain?: Chain | null;
};

const CHAIN_SUFFIX: Record<Chain, string> = { PRIMARY: "EMP", SECONDARY: "ESTFP" };

export function departmentInstitutionId(departmentId: string, chain: Chain | null | undefined) {
  return chain ? `${departmentId}_${CHAIN_SUFFIX[chain]}` : departmentId;
}

export function parseDepartmentInstitutionId(id: string): { departmentId: string; chain: Chain | null } {
  const m = /^(.+)_(EMP|ESTFP)$/.exec(id);
  if (!m) return { departmentId: id, chain: null };
  return { departmentId: m[1]!, chain: m[2] === "EMP" ? "PRIMARY" : "SECONDARY" };
}

export function departmentInstitution(departmentId: string, chain: Chain | null | undefined): Institution {
  return { kind: "DEPARTMENT", id: departmentInstitutionId(departmentId, chain), departmentId, communeId: null, chain: chain ?? null };
}

// Whether a direction of this chain supervises a school or a
// circonscription of that chain. A direction without a chain covers both.
function sameChain(direction: Chain | null | undefined, other: Chain | null | undefined) {
  return !direction || direction === other;
}

export const MINISTRY_ID = "nation";
export const MINISTRY: Institution = { kind: "MINISTRY", id: MINISTRY_ID, departmentId: null, communeId: null };
export const MAILBOX_ROLE_CODE = "INSTITUTION_MAILBOX";
export const MAX_INSTITUTION_RECIPIENTS = 200;

const RANK: Record<InstitutionKind, number> = { MINISTRY: 0, DEPARTMENT: 1, COMMUNE: 2, SCHOOL: 3 };

export function sameInstitution(a: Pick<Institution, "kind" | "id">, b: Pick<Institution, "kind" | "id">) {
  return a.kind === b.kind && a.id === b.id;
}

// Allowed routes, the same both ways:
// - the ministry with any direction, circonscription or school;
// - a DDEMP with its circonscriptions and its nursery and primary schools,
//   a DDESTFP with its secondary schools;
// - a circonscription with the nursery and primary schools of its commune;
// - a school with any other school (transfers, partnerships).
// Two directions, or two circonscriptions, go through the level above.
export function canCorrespond(a: Institution, b: Institution): boolean {
  if (sameInstitution(a, b)) return false;
  const [hi, lo] = RANK[a.kind] <= RANK[b.kind] ? [a, b] : [b, a];
  switch (hi.kind) {
    case "MINISTRY":
      return lo.kind !== "MINISTRY";
    case "DEPARTMENT":
      if (!lo.departmentId || lo.departmentId !== hi.departmentId) return false;
      if (lo.kind === "COMMUNE") return sameChain(hi.chain, "PRIMARY");
      return lo.kind === "SCHOOL" && sameChain(hi.chain, lo.chain);
    case "COMMUNE":
      return lo.kind === "SCHOOL" && !!lo.communeId && lo.communeId === hi.id && lo.chain !== "SECONDARY";
    case "SCHOOL":
      return lo.kind === "SCHOOL";
  }
}

export type StaffProfile = {
  level: "NATIONAL" | "DEPARTMENT" | "COMMUNE" | "SCHOOL" | "SELF";
  departmentId: string | null;
  communeId: string | null;
  schoolId: string | null;
  // The chain of a national or departmental account, and the cycle of the
  // school of a school account (which gives the school's chain).
  chain?: Chain | null;
  schoolCycle?: CycleCode | null;
  // Teacher accounts write as themselves, not for the school.
  isTeacher: boolean;
  canViewMessages: boolean;
};

// The institution a member of staff reads and writes for, if any: heads and
// staff holding message:view at the institution's own level.
export function actingInstitution(p: StaffProfile): Institution | null {
  if (!p.canViewMessages) return null;
  switch (p.level) {
    case "NATIONAL":
      return MINISTRY;
    case "DEPARTMENT":
      return p.departmentId ? departmentInstitution(p.departmentId, p.chain) : null;
    case "COMMUNE":
      return p.communeId ? { kind: "COMMUNE", id: p.communeId, departmentId: p.departmentId, communeId: p.communeId, chain: "PRIMARY" } : null;
    case "SCHOOL":
      return p.schoolId && !p.isTeacher
        ? { kind: "SCHOOL", id: p.schoolId, departmentId: p.departmentId, communeId: p.communeId, chain: p.schoolCycle ? chainOfCycle(p.schoolCycle) : null }
        : null;
    case "SELF":
      return null;
  }
}

// Mailbox identifiers hold two dots and a kind: sign in identifiers built
// from names never do (see lib/auth/username.ts).
export function mailboxUsername(i: Pick<Institution, "kind" | "id">) {
  return `institution.${i.kind.toLowerCase()}.${i.id}`;
}

export function parseMailboxUsername(username: string): { kind: InstitutionKind; id: string } | null {
  const m = /^institution\.(ministry|department|commune|school)\.([A-Za-z0-9_-]{1,60})$/.exec(username);
  return m ? { kind: m[1]!.toUpperCase() as InstitutionKind, id: m[2]! } : null;
}

// Form value of an institution in pickers: "SCHOOL:<id>".
export function institutionKey(i: Pick<Institution, "kind" | "id">) {
  return `${i.kind}:${i.id}`;
}

export function parseInstitutionKey(value: string): { kind: InstitutionKind; id: string } | null {
  const m = /^(MINISTRY|DEPARTMENT|COMMUNE|SCHOOL):([A-Za-z0-9_-]{1,60})$/.exec(value);
  if (!m) return null;
  const kind = m[1] as InstitutionKind;
  if ((kind === "MINISTRY") !== (m[2] === MINISTRY_ID)) return null;
  return { kind, id: m[2]! };
}

// French article before a department name: "de l'Atlantique", "du Borgou".
const DEPARTMENT_OF: Record<string, string> = {
  Alibori: "de l'Alibori",
  Atacora: "de l'Atacora",
  Atlantique: "de l'Atlantique",
  Borgou: "du Borgou",
  Collines: "des Collines",
  Couffo: "du Couffo",
  Donga: "de la Donga",
  Littoral: "du Littoral",
  Mono: "du Mono",
  Ouémé: "de l'Ouémé",
  Plateau: "du Plateau",
  Zou: "du Zou",
};

// The national level of the messaging speaks for both ministries.
export const MINISTRY_NAME = MINISTRIES_NAME;

// "DDESTFP de l'Atlantique", "DDEMP du Borgou"; "Direction départementale de
// l'Atlantique" for a direction without a chain.
export function institutionName(kind: InstitutionKind, name: string | null | undefined, chain?: Chain | null) {
  switch (kind) {
    case "MINISTRY":
      return MINISTRY_NAME;
    case "DEPARTMENT":
      return `${chain ? DIRECTION_OF[chain].short : "Direction départementale"} ${name ? (DEPARTMENT_OF[name] ?? ofPlace(name)) : ""}`.trim();
    case "COMMUNE":
      return `Circonscription scolaire ${name ? ofPlace(name) : ""}`.trim();
    case "SCHOOL":
      return name ?? "Établissement";
  }
}

export const INSTITUTION_GROUPS: Record<InstitutionKind, string> = {
  MINISTRY: "Ministères",
  DEPARTMENT: "Directions départementales",
  COMMUNE: "Circonscriptions scolaires",
  SCHOOL: "Établissements",
};

// Which party of an institutional conversation a message comes from, found
// from where its author works. Null when the author belongs to none of them
// (a person who has since moved).
export function partyOfAuthor(
  author: { level: StaffProfile["level"]; departmentId: string | null; communeId: string | null; schoolId: string | null; chain?: Chain | null },
  parties: Pick<Institution, "kind" | "id">[],
) {
  const i = actingInstitution({ ...author, isTeacher: false, canViewMessages: true });
  return i ? (parties.find((p) => sameInstitution(p, i)) ?? null) : null;
}

// Read receipt of a party for the last message of the other side.
export function receipt(lastFromOtherSide: Date | null | undefined, partyLastReadAt: Date | null | undefined): "read" | "unread" | null {
  if (!lastFromOtherSide) return null;
  return partyLastReadAt && partyLastReadAt >= lastFromOtherSide ? "read" : "unread";
}
