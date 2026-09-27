import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { RESOURCES } from "@/lib/auth/permissions";
import { schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { param, type SearchParams } from "@/lib/list";

type User = NonNullable<CurrentUser>;

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  create: "Création",
  update: "Modification",
  delete: "Suppression",
  export: "Export",
  publish: "Publication",
  lock: "Verrouillage",
  approve: "Décision",
  activate: "Activation",
  deactivate: "Désactivation",
  login: "Connexion",
  login_failed: "Échec de connexion",
  reset_password: "Réinitialisation du mot de passe",
  revoke_sessions: "Fermeture de sessions",
  denied: "Action refusée",
  seed: "Initialisation",
};

// Journal entries also name records that are not permission resources.
export const AUDIT_RESOURCE_LABELS: Record<string, string> = {
  ...RESOURCES,
  system: "Système",
  statistics: "Statistiques",
  session: "Connexions",
  academic_year: "Années scolaires",
  council_decision: "Décisions de fin d'année",
  transfer: "Transferts",
  record_access: "Accès aux dossiers d'élèves",
  required_piece: "Pièces à fournir",
  document: "Documents délivrés",
  signature: "Signature électronique",
  conversation: "Messagerie",
  fee_type: "Types de frais",
  invoice: "Factures",
  payment_account: "Comptes de paiement",
  payment_declaration: "Paiements déclarés par les parents",
  online_payment: "Paiements en ligne",
};

export const actionLabel = (a: string) => AUDIT_ACTION_LABELS[a] ?? a;
export const resourceLabel = (r: string) => AUDIT_RESOURCE_LABELS[r] ?? r;

// Rows a user may read:
// - national: everything;
// - department and commune: rows about a school of their territory, plus
//   their own actions;
// - school: rows about their school.
export async function auditScopeWhere(user: User): Promise<Prisma.AuditLogWhereInput> {
  const s = user.scope;
  switch (s.level) {
    case "NATIONAL":
      return {};
    case "DEPARTMENT":
    case "COMMUNE": {
      const schools = await db.school.findMany({ where: schoolWhere(user), select: { id: true } });
      return { OR: [{ schoolId: { in: schools.map((x) => x.id) } }, { userId: user.id }] };
    }
    case "SCHOOL":
      return s.schoolId ? { schoolId: s.schoolId } : { id: "__none__" };
    case "SELF":
      return { userId: user.id };
  }
}

export type AuditFilters = { action: string | null; resource: string | null; who: string; from: string | null; to: string | null };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function auditFilters(sp: SearchParams): AuditFilters {
  const from = param(sp, "du");
  const to = param(sp, "au");
  return {
    action: (param(sp, "action") ?? "").slice(0, 40) || null,
    resource: (param(sp, "ressource") ?? "").slice(0, 40) || null,
    who: (param(sp, "utilisateur") ?? "").trim().slice(0, 100),
    from: from && DAY.test(from) ? from : null,
    to: to && DAY.test(to) ? to : null,
  };
}

// Days are read in Benin time (UTC+1, no daylight saving).
function dayStart(day: string) {
  const d = new Date(`${day}T00:00:00+01:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function auditListWhere(user: User, f: AuditFilters): Promise<Prisma.AuditLogWhereInput> {
  const and: Prisma.AuditLogWhereInput[] = [await auditScopeWhere(user)];
  if (f.action) and.push({ action: f.action });
  if (f.resource) and.push({ resource: f.resource });
  if (f.who)
    and.push({
      user: {
        OR: [
          { email: { contains: f.who, mode: "insensitive" } },
          { lastName: { contains: f.who, mode: "insensitive" } },
          { firstName: { contains: f.who, mode: "insensitive" } },
        ],
      },
    });
  const from = f.from ? dayStart(f.from) : null;
  const to = f.to ? dayStart(f.to) : null;
  if (from) and.push({ createdAt: { gte: from } });
  if (to) and.push({ createdAt: { lt: new Date(to.getTime() + 86400000) } });
  return { AND: and };
}

const select = {
  id: true,
  action: true,
  resource: true,
  resourceId: true,
  summary: true,
  schoolId: true,
  ip: true,
  createdAt: true,
  user: { select: { firstName: true, lastName: true, email: true, role: { select: { name: true } } } },
} as const;

export async function listAudit(user: User, f: AuditFilters, page: { skip: number; take: number }) {
  const where = await auditListWhere(user, f);
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({ where, select, orderBy: { createdAt: "desc" }, skip: page.skip, take: page.take }),
    db.auditLog.count({ where }),
  ]);
  return { rows, total };
}

export async function exportAudit(user: User, f: AuditFilters) {
  return db.auditLog.findMany({ where: await auditListWhere(user, f), select, orderBy: { createdAt: "desc" }, take: 10000 });
}

// Values present in the user's scope, for the filter selects.
export async function auditFilterOptions(user: User) {
  const scope = await auditScopeWhere(user);
  const [actions, resources] = await Promise.all([
    db.auditLog.groupBy({ by: ["action"], where: scope, orderBy: { action: "asc" } }),
    db.auditLog.groupBy({ by: ["resource"], where: scope, orderBy: { resource: "asc" } }),
  ]);
  return { actions: actions.map((a) => a.action), resources: resources.map((r) => r.resource) };
}

export async function recentActivity(user: User, take = 8) {
  return db.auditLog.findMany({ where: await auditScopeWhere(user), select, orderBy: { createdAt: "desc" }, take });
}
