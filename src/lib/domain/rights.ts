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
