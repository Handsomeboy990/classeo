// Which connection events a viewer may read, and the filters of the page.
// Pure: the page, the CSV export and the tests share it
// (connections.test.ts).
//
// The events carry a copy of the account's territory and chain
// (record.ts). A national account reads every event, or those of its chain
// when it has one; a departmental account the events of its department and
// chain; a circonscription those of its commune, primary chain. Attempts on
// unknown identifiers have no territory: only an unrestricted national
// account sees them. Fails closed: an incomplete scope reads nothing.

import { Prisma } from "@/generated/prisma/client";

import type { SearchParams } from "@/lib/list";
import { param } from "@/lib/list";

export type Chain = "PRIMARY" | "SECONDARY";
export type Outcome = "SUCCESS" | "WRONG_PASSWORD" | "LOCKED" | "DISABLED" | "UNKNOWN_ACCOUNT" | "RATE_LIMITED" | "SIGN_OUT";

export const OUTCOMES: Outcome[] = ["SUCCESS", "WRONG_PASSWORD", "LOCKED", "DISABLED", "UNKNOWN_ACCOUNT", "RATE_LIMITED", "SIGN_OUT"];
export const FAILURES: Outcome[] = ["WRONG_PASSWORD", "LOCKED", "DISABLED", "UNKNOWN_ACCOUNT", "RATE_LIMITED"];

export const OUTCOME_LABELS: Record<Outcome, string> = {
  SUCCESS: "Connexion réussie",
  WRONG_PASSWORD: "Mot de passe incorrect",
  LOCKED: "Compte verrouillé",
  DISABLED: "Compte désactivé",
  UNKNOWN_ACCOUNT: "Identifiant inconnu",
  RATE_LIMITED: "Trop de tentatives",
  SIGN_OUT: "Déconnexion",
};

export type ConnectionScope = { none: true } | { none: false; departmentId?: string; communeId?: string; schoolId?: string; chain?: Chain };

type Viewer = { scope: { level: "NATIONAL" | "DEPARTMENT" | "COMMUNE" | "SCHOOL" | "SELF"; departmentId: string | null; communeId: string | null; schoolId: string | null; chain: Chain | null } };

export function connectionScope(user: Viewer): ConnectionScope {
  const s = user.scope;
  const chain = s.chain ?? undefined;
  switch (s.level) {
    case "NATIONAL":
      return { none: false, chain };
    case "DEPARTMENT":
      return s.departmentId ? { none: false, departmentId: s.departmentId, chain } : { none: true };
    case "COMMUNE":
      return s.communeId ? { none: false, communeId: s.communeId, chain: "PRIMARY" } : { none: true };
    case "SCHOOL":
      return s.schoolId ? { none: false, schoolId: s.schoolId } : { none: true };
    default:
      return { none: true };
  }
}

export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];

export type ConnectionFilters = { days: Period; role: string | null; departmentId: string | null; outcome: Outcome | null };

const ID = /^[a-z0-9]{8,40}$/i;
const ROLE = /^[A-Z_]{2,40}$/;

export function connectionFilters(sp: SearchParams, viewerLevel: Viewer["scope"]["level"]): ConnectionFilters {
  const days = Number(param(sp, "periode"));
  const role = param(sp, "role") ?? "";
  const dep = param(sp, "departement") ?? "";
  const outcome = param(sp, "resultat") ?? "";
  return {
    days: (PERIODS as readonly number[]).includes(days) ? (days as Period) : 30,
    role: ROLE.test(role) ? role : null,
    // Only a national account chooses a department; the others have theirs.
    departmentId: viewerLevel === "NATIONAL" && ID.test(dep) ? dep : null,
    outcome: (OUTCOMES as string[]).includes(outcome) ? (outcome as Outcome) : null,
  };
}

// Start of the first day of the period, in Benin time (UTC+1, no daylight
// saving): 30 days is today and the 29 days before.
export function periodStart(days: number, now = new Date()) {
  const benin = new Date(now.getTime() + 60 * 60 * 1000);
  const midnight = Date.UTC(benin.getUTCFullYear(), benin.getUTCMonth(), benin.getUTCDate()) - 60 * 60 * 1000;
  return new Date(midnight - (days - 1) * 24 * 60 * 60 * 1000);
}

// The days of the period as YYYY-MM-DD, oldest first.
export function periodDays(days: number, now = new Date()) {
  const start = periodStart(days, now).getTime() + 60 * 60 * 1000;
  return Array.from({ length: days }, (_, i) => new Date(start + i * 86400000).toISOString().slice(0, 10));
}

export function connectionWhere(scope: ConnectionScope, f: ConnectionFilters, now = new Date()): Prisma.ConnectionEventWhereInput {
  if (scope.none) return { id: "__none__" };
  return {
    createdAt: { gte: periodStart(f.days, now) },
    ...(scope.departmentId || f.departmentId ? { departmentId: scope.departmentId ?? f.departmentId! } : {}),
    ...(scope.communeId ? { communeId: scope.communeId } : {}),
    ...(scope.schoolId ? { schoolId: scope.schoolId } : {}),
    ...(scope.chain ? { chain: scope.chain } : {}),
    ...(f.role ? { roleCode: f.role } : {}),
    ...(f.outcome ? { outcome: f.outcome } : {}),
  };
}

// The same rule as connectionWhere, for the aggregate queries written in
// SQL (every value is a bound parameter). `e` is the alias of the table.
export function connectionSql(scope: ConnectionScope, f: ConnectionFilters, now = new Date()): Prisma.Sql {
  if (scope.none) return Prisma.sql`FALSE`;
  const parts: Prisma.Sql[] = [Prisma.sql`e."createdAt" >= ${periodStart(f.days, now)}`];
  const dep = scope.departmentId ?? f.departmentId;
  if (dep) parts.push(Prisma.sql`e."departmentId" = ${dep}`);
  if (scope.communeId) parts.push(Prisma.sql`e."communeId" = ${scope.communeId}`);
  if (scope.schoolId) parts.push(Prisma.sql`e."schoolId" = ${scope.schoolId}`);
  if (scope.chain) parts.push(Prisma.sql`e."chain" = ${scope.chain}::"EducationChain"`);
  if (f.role) parts.push(Prisma.sql`e."roleCode" = ${f.role}`);
  if (f.outcome) parts.push(Prisma.sql`e."outcome" = ${f.outcome}::"ConnectionOutcome"`);
  return Prisma.join(parts, " AND ");
}
