// Rights rules: who may hand which role, on which entity, and how a role's
// permission set may change. Pure functions, enforced by the server actions of
// the users and rights modules and covered by unit tests.

import { randomInt } from "node:crypto";

export type ScopeLevel = "NATIONAL" | "DEPARTMENT" | "COMMUNE" | "SCHOOL" | "SELF";

// Higher is wider. SELF (parents, students) sits below a school.
export const SCOPE_RANK: Record<ScopeLevel, number> = { NATIONAL: 4, DEPARTMENT: 3, COMMUNE: 2, SCHOOL: 1, SELF: 0 };

export const SCOPE_LABELS: Record<ScopeLevel, string> = {
  NATIONAL: "National",
  DEPARTMENT: "Département",
  COMMUNE: "Commune",
  SCHOOL: "Établissement",
  SELF: "Personnel (parent, élève)",
};

// A position in the territory with its full ancestry, for example a school
// together with its commune and department.
export type ScopeRef = {
  level: ScopeLevel;
  departmentId?: string | null;
  communeId?: string | null;
  schoolId?: string | null;
};

export type RuleResult = { ok: true } | { ok: false; reason: string };

const ok: RuleResult = { ok: true };
const fail = (reason: string): RuleResult => ({ ok: false, reason });

export function isLevelAtOrBelow(level: ScopeLevel, reference: ScopeLevel) {
  return SCOPE_RANK[level] <= SCOPE_RANK[reference];
}

// True when the target position lies inside the actor's territory, at the
// actor's level or below. Fails closed on an incomplete scope.
export function isWithinScope(actor: ScopeRef, target: ScopeRef): boolean {
  if (!isLevelAtOrBelow(target.level, actor.level)) return false;
  switch (actor.level) {
    case "NATIONAL":
      return true;
    case "DEPARTMENT":
      return !!actor.departmentId && target.departmentId === actor.departmentId;
    case "COMMUNE":
      return !!actor.communeId && target.communeId === actor.communeId;
    case "SCHOOL":
      return !!actor.schoolId && target.schoolId === actor.schoolId;
    case "SELF":
      return false;
  }
}

type Actor = { permissions: Iterable<string>; scopeLevel: ScopeLevel };
type RoleShape = { permissions: Iterable<string>; scopeLevel: ScopeLevel };

// Anti privilege escalation: a role may only be assigned by someone who holds
// every one of its permissions and acts at the role's level or above.
export function canAssignRole(actor: Actor, role: RoleShape): RuleResult {
  if (!isLevelAtOrBelow(role.scopeLevel, actor.scopeLevel))
    return fail("Ce rôle agit à un niveau supérieur au vôtre : vous ne pouvez pas l'attribuer.");
  const held = new Set(actor.permissions);
  const missing = [...role.permissions].filter((p) => !held.has(p));
  if (missing.length) return fail(`Ce rôle donne des droits que vous ne détenez pas (${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""}).`);
  return ok;
}

// Assigning a role on an entity: the role rule, then the entity must sit
// inside the actor's territory at exactly the role's level.
export function canAssignRoleOn(actor: Actor & { scope: ScopeRef }, role: RoleShape, target: ScopeRef): RuleResult {
  const byRole = canAssignRole(actor, role);
  if (!byRole.ok) return byRole;
  if (target.level !== role.scopeLevel) return fail("Le périmètre choisi ne correspond pas au niveau du rôle.");
  if (!isWithinScope(actor.scope, target)) return fail("Le périmètre choisi est en dehors du vôtre.");
  return ok;
}

// Permissions a role must keep, so that nobody can lock the ministry out of
// rights management.
export const PROTECTED_PERMISSIONS: Record<string, string[]> = {
  NATIONAL_ADMIN: ["role:view", "role:update"],
};

export type RoleUpdatePlan =
  | { ok: true; added: string[]; removed: string[]; next: string[] }
  | { ok: false; reason: string };

// Plans a change of a role's permission set from the submitted checkboxes.
// - A permission the actor does not hold cannot be granted, and when it is
//   already on the role it is kept as is: the actor cannot see it as editable
//   so its absence from the form is not a removal.
// - The protected permissions of a role cannot be removed.
// - The role must act at the actor's level or below.
export function planRoleUpdate(input: {
  actor: Actor;
  role: { code: string; scopeLevel: ScopeLevel };
  current: Iterable<string>;
  submitted: Iterable<string>;
  catalogue: Iterable<string>;
}): RoleUpdatePlan {
  const held = new Set(input.actor.permissions);
  const known = new Set(input.catalogue);
  const current = new Set(input.current);
  const submitted = new Set(input.submitted);

  if (!isLevelAtOrBelow(input.role.scopeLevel, input.actor.scopeLevel))
    return { ok: false, reason: "Ce rôle agit à un niveau supérieur au vôtre : vous ne pouvez pas le modifier." };

  const unknown = [...submitted].filter((p) => !known.has(p));
  if (unknown.length) return { ok: false, reason: `Droit inconnu : ${unknown[0]}.` };

  const notHeld = [...submitted].filter((p) => !held.has(p) && !current.has(p));
  if (notHeld.length) return { ok: false, reason: `Vous ne pouvez pas accorder un droit que vous ne détenez pas (${notHeld[0]}).` };

  const next = new Set<string>();
  for (const p of submitted) next.add(p);
  for (const p of current) if (!held.has(p)) next.add(p);

  const protectedList = PROTECTED_PERMISSIONS[input.role.code] ?? [];
  const lost = protectedList.filter((p) => current.has(p) && !next.has(p));
  if (lost.length)
    return { ok: false, reason: `Le rôle doit conserver ${lost.join(" et ")} : sans eux, plus personne ne pourrait gérer les droits.` };

  const added = [...next].filter((p) => !current.has(p)).sort();
  const removed = [...current].filter((p) => !next.has(p)).sort();
  return { ok: true, added, removed, next: [...next].sort() };
}

// Levels a custom role may act at. Family roles (SELF) are tied to student
// records and stay the system parent and student roles.
export const CUSTOM_ROLE_LEVELS: ScopeLevel[] = ["NATIONAL", "DEPARTMENT", "COMMUNE", "SCHOOL"];

export type RoleCreatePlan = { ok: true; permissions: string[]; dropped: string[] } | { ok: false; reason: string };

// Plans a new custom role, empty or copied from an existing role.
// - Its level is one the actor acts at or below, never SELF.
// - It only receives permissions the actor holds: those of the source role
//   the actor lacks are dropped and reported, not granted.
export function planRoleCreate(input: { actor: Actor; scopeLevel: ScopeLevel; source?: Iterable<string> | null; catalogue: Iterable<string> }): RoleCreatePlan {
  if (!CUSTOM_ROLE_LEVELS.includes(input.scopeLevel))
    return { ok: false, reason: "Un rôle personnalisé agit au niveau national, d'un département, d'une commune ou d'un établissement." };
  if (!isLevelAtOrBelow(input.scopeLevel, input.actor.scopeLevel))
    return { ok: false, reason: "Vous ne pouvez pas créer un rôle d'un niveau supérieur au vôtre." };
  const held = new Set(input.actor.permissions);
  const known = new Set(input.catalogue);
  const source = [...new Set(input.source ?? [])].filter((p) => known.has(p));
  const permissions = source.filter((p) => held.has(p)).sort();
  const dropped = source.filter((p) => !held.has(p)).sort();
  return { ok: true, permissions, dropped };
}

// Renaming and describing a role: custom roles only, at the actor's level or
// below. System roles keep their names, which the documentation and the demo
// refer to; their permissions stay editable through the matrix.
export function canEditRoleDetails(actor: Actor, role: { isSystem: boolean; scopeLevel: ScopeLevel }): RuleResult {
  if (role.isSystem) return fail("Le nom et la description d'un rôle système ne se modifient pas. Ses droits restent modifiables.");
  if (!isLevelAtOrBelow(role.scopeLevel, actor.scopeLevel)) return fail("Ce rôle agit à un niveau supérieur au vôtre : vous ne pouvez pas le modifier.");
  return ok;
}

export type RoleDeletionPlan = { ok: true; move: boolean } | { ok: false; reason: string };

// Deleting a custom role.
// - System roles are never deleted.
// - The actor must be able to assign the role (all its permissions, level at
//   or below theirs).
// - Every account holding it must be inside the actor's scope and is moved to
//   a target role of the same level that the actor could assign; without
//   accounts, no target is needed.
export function planRoleDeletion(input: {
  actor: Actor;
  role: { id: string; isSystem: boolean } & RoleShape;
  holders: { total: number; inScope: number };
  target?: ({ id: string } & RoleShape) | null;
}): RoleDeletionPlan {
  const { actor, role, holders, target } = input;
  if (role.isSystem) return { ok: false, reason: "Un rôle système ne peut pas être supprimé." };
  const own = canAssignRole(actor, role);
  if (!own.ok) return { ok: false, reason: "Ce rôle donne des droits que vous ne détenez pas ou agit au-dessus de votre niveau : vous ne pouvez pas le supprimer." };
  if (holders.total === 0) return { ok: true, move: false };
  // The number is not given: it would describe activity outside the
  // actor's territory.
  if (holders.inScope < holders.total) return { ok: false, reason: "Des comptes hors de votre périmètre utilisent ce rôle : il ne peut pas être supprimé." };
  if (!target) return { ok: false, reason: "Des comptes utilisent ce rôle : choisissez le rôle qui les accueillera." };
  if (target.id === role.id) return { ok: false, reason: "Choisissez un autre rôle que celui à supprimer." };
  if (target.scopeLevel !== role.scopeLevel) return { ok: false, reason: "Le rôle d'accueil doit agir au même niveau, pour que chaque compte garde son périmètre." };
  const byTarget = canAssignRole(actor, target);
  if (!byTarget.ok) return byTarget;
  return { ok: true, move: true };
}

const foldName = (v: string) =>
  v
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

// Two role names that differ only by case, accents or spacing are the same
// name for the people choosing a role from a list.
export function sameRoleName(a: string, b: string) {
  return foldName(a) === foldName(b);
}

// Stable technical code of a custom role, unique thanks to the suffix.
export function customRoleCode(name: string, suffix: string) {
  const slug = foldName(name)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32)
    .toUpperCase();
  return `CUSTOM_${slug || "ROLE"}_${suffix.toUpperCase()}`;
}

// Temporary password shown once to the administrator. It satisfies the
// password policy (10 characters minimum, a letter and a digit) and avoids
// characters that are easy to misread when dictated (0/O, 1/l/I).
const LETTERS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";

export function generateTemporaryPassword(length = 12, random: (max: number) => number = randomInt) {
  const size = Math.max(10, length);
  const all = LETTERS + DIGITS;
  const chars = [LETTERS[random(LETTERS.length)]!, DIGITS[random(DIGITS.length)]!];
  while (chars.length < size) chars.push(all[random(all.length)]!);
  // Fisher-Yates, so the guaranteed letter and digit are not always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}
