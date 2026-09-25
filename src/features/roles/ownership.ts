// Delegated rights: a school, a commune or a department creates roles for its
// own staff. Pure rules, unit tested; the rights and users actions apply them
// next to the anti escalation rules of lib/domain/rights.ts.
//
// - A national role (no owner) is usable everywhere and only the national
//   level edits it.
// - A role owned by an entity is edited by that entity (or by the national
//   level) and is only assigned to accounts inside that entity.

import type { RuleResult, ScopeLevel, ScopeRef } from "@/lib/domain/rights";

export type RoleOwner = { ownerSchoolId: string | null; ownerCommuneId: string | null; ownerDepartmentId: string | null };

export type ActorScope = { level: ScopeLevel; departmentId: string | null; communeId: string | null; schoolId: string | null };

const ok: RuleResult = { ok: true };
const fail = (reason: string): RuleResult => ({ ok: false, reason });

export function isNationalRole(role: RoleOwner) {
  return !role.ownerSchoolId && !role.ownerCommuneId && !role.ownerDepartmentId;
}

// The owner given to a role created by this actor: its own entity, or none
// for the national level. Null when the actor cannot own roles (a family
// account, an incomplete scope).
export function ownerFor(actor: ActorScope): RoleOwner | null {
  const none = { ownerSchoolId: null, ownerCommuneId: null, ownerDepartmentId: null };
  switch (actor.level) {
    case "NATIONAL":
      return none;
    case "DEPARTMENT":
      return actor.departmentId ? { ...none, ownerDepartmentId: actor.departmentId } : null;
    case "COMMUNE":
      return actor.communeId ? { ...none, ownerCommuneId: actor.communeId } : null;
    case "SCHOOL":
      return actor.schoolId ? { ...none, ownerSchoolId: actor.schoolId } : null;
    case "SELF":
      return null;
  }
}

export function sameOwner(a: RoleOwner, b: RoleOwner) {
  return a.ownerSchoolId === b.ownerSchoolId && a.ownerCommuneId === b.ownerCommuneId && a.ownerDepartmentId === b.ownerDepartmentId;
}

// Levels a role created by this actor may act at. The national level keeps
// its choice among the levels at or below its own; an entity creates roles
// for its own level only, so a school role stays a school role.
export function creatableLevels(actor: ActorScope): ScopeLevel[] {
  if (actor.level === "NATIONAL") return ["NATIONAL", "DEPARTMENT", "COMMUNE", "SCHOOL"];
  return actor.level === "SELF" || !ownerFor(actor) ? [] : [actor.level];
}

// Changing a role (its rights, its name, its deletion): the national level
// for every role, an entity only for the roles it owns.
export function canManageRole(actor: ActorScope, role: RoleOwner): RuleResult {
  if (actor.level === "NATIONAL") return ok;
  const own = ownerFor(actor);
  if (own && !isNationalRole(role) && sameOwner(own, role)) return ok;
  return fail(isNationalRole(role) ? "Rôle national : il se consulte ici, seul le ministère le modifie." : "Ce rôle appartient à une autre entité : vous ne pouvez pas le modifier.");
}

// Whether an owned role can be held by an account at this position: only
// inside the entity that owns it. National roles fit everywhere.
export function roleFitsTarget(role: RoleOwner, target: ScopeRef): RuleResult {
  if (role.ownerSchoolId && target.schoolId !== role.ownerSchoolId) return fail("Ce rôle appartient à un autre établissement.");
  if (role.ownerCommuneId && target.communeId !== role.ownerCommuneId) return fail("Ce rôle appartient à une autre commune.");
  if (role.ownerDepartmentId && target.departmentId !== role.ownerDepartmentId) return fail("Ce rôle appartient à un autre département.");
  return ok;
}

// The role receiving the accounts of a deleted role must fit them too: a
// national role, or one of the same owner.
export function canReceiveHolders(deleted: RoleOwner, target: RoleOwner): RuleResult {
  if (isNationalRole(target) || sameOwner(deleted, target)) return ok;
  return fail("Le rôle d'accueil appartient à une autre entité.");
}
