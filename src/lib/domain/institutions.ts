// Institutions as messaging parties. Pure, unit tested.
//
// The ministry, a departmental direction, a school district (circonscription,
// one per commune) and a school can write to one another. A conversation
// between institutions belongs to the institutions, not to the people: every
// authorised member of staff of an institution sees it, answers on its
// behalf, and each message still records the person who wrote it.
//
// Storage: each institution is represented in a conversation by a mailbox
// account, a user row that can never sign in (inactive, no password, a role
// without permissions), whose read marker is the institution's read receipt.

export type InstitutionKind = "MINISTRY" | "DEPARTMENT" | "COMMUNE" | "SCHOOL";

export type Institution = {
  kind: InstitutionKind;
  // The department, commune or school id; "nation" for the ministry.
  id: string;
  // Territory above the institution (itself for a department or a commune).
  departmentId: string | null;
  communeId: string | null;
};

export const MINISTRY_ID = "nation";
export const MINISTRY: Institution = { kind: "MINISTRY", id: MINISTRY_ID, departmentId: null, communeId: null };
export const MAILBOX_ROLE_CODE = "INSTITUTION_MAILBOX";
export const MAX_INSTITUTION_RECIPIENTS = 200;

const RANK: Record<InstitutionKind, number> = { MINISTRY: 0, DEPARTMENT: 1, COMMUNE: 2, SCHOOL: 3 };

export function sameInstitution(a: Pick<Institution, "kind" | "id">, b: Pick<Institution, "kind" | "id">) {
  return a.kind === b.kind && a.id === b.id;
}

// Allowed routes, the same both ways:
// - the ministry with any department, district or school;
// - a department with its districts and its schools;
// - a district with its schools;
// - a school with any other school (transfers, partnerships).
// Two departments, or two districts, go through the level above.
export function canCorrespond(a: Institution, b: Institution): boolean {
  if (sameInstitution(a, b)) return false;
  const [hi, lo] = RANK[a.kind] <= RANK[b.kind] ? [a, b] : [b, a];
  switch (hi.kind) {
    case "MINISTRY":
      return lo.kind !== "MINISTRY";
    case "DEPARTMENT":
      return (lo.kind === "COMMUNE" || lo.kind === "SCHOOL") && !!lo.departmentId && lo.departmentId === hi.id;
    case "COMMUNE":
      return lo.kind === "SCHOOL" && !!lo.communeId && lo.communeId === hi.id;
    case "SCHOOL":
      return lo.kind === "SCHOOL";
  }
}

export type StaffProfile = {
  level: "NATIONAL" | "DEPARTMENT" | "COMMUNE" | "SCHOOL" | "SELF";
  departmentId: string | null;
  communeId: string | null;
  schoolId: string | null;
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
      return p.departmentId ? { kind: "DEPARTMENT", id: p.departmentId, departmentId: p.departmentId, communeId: null } : null;
    case "COMMUNE":
      return p.communeId ? { kind: "COMMUNE", id: p.communeId, departmentId: p.departmentId, communeId: p.communeId } : null;
    case "SCHOOL":
      return p.schoolId && !p.isTeacher ? { kind: "SCHOOL", id: p.schoolId, departmentId: p.departmentId, communeId: p.communeId } : null;
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
  const m = /^institution\.(ministry|department|commune|school)\.([A-Za-z0-9_-]{1,40})$/.exec(username);
  return m ? { kind: m[1]!.toUpperCase() as InstitutionKind, id: m[2]! } : null;
}

// Form value of an institution in pickers: "SCHOOL:<id>".
export function institutionKey(i: Pick<Institution, "kind" | "id">) {
  return `${i.kind}:${i.id}`;
}

export function parseInstitutionKey(value: string): { kind: InstitutionKind; id: string } | null {
  const m = /^(MINISTRY|DEPARTMENT|COMMUNE|SCHOOL):([A-Za-z0-9_-]{1,40})$/.exec(value);
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

// "d'Abomey-Calavi", "de Cotonou".
export function ofPlace(name: string) {
  return /^[AEIOUYÀÂÉÈÊÎÏÔÛ]/i.test(name) ? `d'${name}` : `de ${name}`;
}

export const MINISTRY_NAME = "Ministère des Enseignements";

export function institutionName(kind: InstitutionKind, name: string | null | undefined) {
  switch (kind) {
    case "MINISTRY":
      return MINISTRY_NAME;
    case "DEPARTMENT":
      return `Direction départementale ${name ? (DEPARTMENT_OF[name] ?? ofPlace(name)) : ""}`.trim();
    case "COMMUNE":
      return `Circonscription scolaire ${name ? ofPlace(name) : ""}`.trim();
    case "SCHOOL":
      return name ?? "Établissement";
  }
}

export const INSTITUTION_GROUPS: Record<InstitutionKind, string> = {
  MINISTRY: "Ministère",
  DEPARTMENT: "Directions départementales",
  COMMUNE: "Circonscriptions scolaires",
  SCHOOL: "Établissements",
};

// Which party of an institutional conversation a message comes from, found
// from where its author works. Null when the author belongs to none of them
// (a person who has since moved).
export function partyOfAuthor(
  author: { level: StaffProfile["level"]; departmentId: string | null; communeId: string | null; schoolId: string | null },
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
