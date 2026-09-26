// Forgotten password without e-mail: who helps whom. Pure rules, unit tested;
// the queries and actions of this module apply them.
//
// A request goes up the hierarchy, to the level that manages the account:
// - pupils, parents and school staff: the school head (a school account
//   holding user:update);
// - heads of nursery and primary schools (and any school account managing
//   accounts): the circonscription scolaire;
// - heads of secondary schools: the DDESTFP, since the secondary chain has
//   no circonscription;
// - chefs de circonscription: the departmental direction (DDEMP);
// - departmental directors and national agents: the ministry.

import { chainOfCycle, type CycleCode } from "@/lib/domain/chains";
import { canAssignRole, SCOPE_RANK, type RuleResult, type ScopeLevel } from "@/lib/domain/rights";

export type HelpLevel = "SCHOOL" | "COMMUNE" | "DEPARTMENT" | "NATIONAL";

export const MANAGE_USERS = "user:update";

export const HELP_LEVEL_LABELS: Record<HelpLevel, string> = {
  SCHOOL: "votre chef d'établissement",
  COMMUNE: "la circonscription scolaire",
  DEPARTMENT: "la direction départementale",
  NATIONAL: "le ministère",
};

export function helpRouteLevel(requester: { scopeLevel: ScopeLevel; managesUsers: boolean; schoolCycle?: CycleCode | null }): HelpLevel {
  switch (requester.scopeLevel) {
    case "SELF":
      return "SCHOOL";
    case "SCHOOL":
      if (!requester.managesUsers) return "SCHOOL";
      return requester.schoolCycle && chainOfCycle(requester.schoolCycle) === "SECONDARY" ? "DEPARTMENT" : "COMMUNE";
    case "COMMUNE":
      return "DEPARTMENT";
    case "DEPARTMENT":
    case "NATIONAL":
      return "NATIONAL";
  }
}

type Account = { scopeLevel: ScopeLevel; permissions: Iterable<string>; schoolCycle?: CycleCode | null };

// Whether this handler may reset the requester's password. The request must
// be routed to the handler's level (its territory is checked by the query).
// Supervising a lower level is what the hierarchy is for; between peers of
// the same level the anti escalation rule applies, as for any reset.
export function canHandleHelp(handler: Account, requester: Account): RuleResult {
  const held = new Set(handler.permissions);
  if (!held.has(MANAGE_USERS)) return { ok: false, reason: "Votre rôle ne permet pas de réinitialiser un mot de passe." };
  const requesterPermissions = [...requester.permissions];
  const route = helpRouteLevel({ scopeLevel: requester.scopeLevel, managesUsers: requesterPermissions.includes(MANAGE_USERS), schoolCycle: requester.schoolCycle });
  if (route !== handler.scopeLevel) return { ok: false, reason: "Cette demande est adressée à un autre niveau de l'administration." };
  if (requester.scopeLevel === "SELF" || SCOPE_RANK[requester.scopeLevel] < SCOPE_RANK[handler.scopeLevel]) return { ok: true };
  const peer = canAssignRole({ permissions: held, scopeLevel: handler.scopeLevel }, { permissions: requesterPermissions, scopeLevel: requester.scopeLevel });
  return peer.ok ? peer : { ok: false, reason: "Ce compte a des droits que vous ne détenez pas : sa demande doit être traitée plus haut." };
}
