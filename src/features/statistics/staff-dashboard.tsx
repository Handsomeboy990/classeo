import { ArrowRight, BarChart3, Inbox, KeyRound, Landmark, Map, ScrollText, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { BarChart } from "@/components/kit/bar-chart";
import { PageHeader } from "@/components/kit/page-header";
import { EmptyState } from "@/components/kit/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { actionLabel, recentActivity } from "@/features/audit/queries";
import { REQUEST_TYPE_LABELS } from "@/features/requests/labels";
import { recentPendingRequests } from "@/features/requests/queries";
import { can } from "@/lib/auth/authorize";
import type { CurrentUser } from "@/lib/auth/session";
import { sortByIndicator, type IndicatorKey } from "@/lib/domain/indicators";
import { formatDate, formatDateTime } from "@/lib/utils";

import { userStatScope } from "../territory/scope";
import { IndicatorCards } from "./components/indicator-cards";
import { ABSENCE_SCALE, absenceTone, formatIndicator, indicatorFormatter } from "./format";
import { CHILD_LABELS, getStatistics, loadYears, type ScopeStatistics } from "./queries";

type User = NonNullable<CurrentUser>;

// Dashboard for ministry, departmental, communal and school staff. The same
// component serves every level: key figures of the user's scope, comparison
// of its subdivisions, requests waiting for a decision and recent activity.
// Every block is driven by a permission.
export async function StaffDashboard({ user }: { user: User }) {
  const scope = userStatScope(user);
  const showStats = can(user, "statistics:view") && !!scope;
  const showRequests = can(user, "request:view");
  const showActivity = can(user, "audit:view");

  const [stats, years, pending, activity] = await Promise.all([
    showStats && scope ? getStatistics(scope) : Promise.resolve(null),
    loadYears(),
    showRequests ? recentPendingRequests(user, 5) : Promise.resolve([]),
    showActivity ? recentActivity(user, 8) : Promise.resolve([]),
  ]);

  const links = [
    { href: "/espace/territoire", label: "Territoire", icon: Map, show: can(user, "territory:view") && user.scope.level !== "SCHOOL" },
    { href: "/espace/statistiques", label: "Statistiques détaillées", icon: BarChart3, show: showStats },
    { href: "/espace/etablissements", label: "Établissements", icon: Landmark, show: can(user, "school:view") && user.scope.level !== "SCHOOL" },
    { href: `/espace/etablissements/${user.scope.schoolId}`, label: "Fiche de l'établissement", icon: Landmark, show: can(user, "school:view") && user.scope.level === "SCHOOL" },
    { href: "/espace/demandes", label: "Demandes", icon: Inbox, show: showRequests },
    { href: "/espace/utilisateurs", label: "Comptes utilisateurs", icon: KeyRound, show: can(user, "user:view") },
    { href: "/espace/droits", label: "Rôles et droits", icon: ShieldCheck, show: can(user, "role:view") },
    { href: "/espace/journal", label: "Journal d'activité", icon: ScrollText, show: showActivity },
  ].filter((l) => l.show);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Bonjour, ${user.firstName}`} description={`${user.role.name} · ${user.scope.label} · Année scolaire ${years.current?.label ?? ""}`} />

      {stats && <IndicatorCards stats={stats} requestsHref={showRequests ? "/espace/demandes?statut=PENDING" : undefined} />}

      {stats && stats.children.length > 0 && (
        <div className="grid gap-4 *:min-w-0 lg:grid-cols-2">
          <ComparisonCard stats={stats} indicator="passRate" title={`Taux de réussite ${stats.previousYearLabel ?? ""}`} user={user} />
          <ComparisonCard stats={stats} indicator="absenceRate" title="Taux d'absence cette année" user={user} />
        </div>
      )}

      <div className="grid gap-4 *:min-w-0 lg:grid-cols-2">
        {showRequests && (
          <Card>
            <CardHeader>
              <CardTitle>Demandes en attente</CardTitle>
              <Link href="/espace/demandes?statut=PENDING" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                Tout voir <ArrowRight className="size-4" aria-hidden />
              </Link>
            </CardHeader>
            <CardBody>
              {pending.length === 0 ? (
                <EmptyState title="Aucune demande en attente" className="py-6" />
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {pending.map((r) => (
                    <li key={r.id} className="py-2.5 first:pt-0 last:pb-0">
                      <Link href={`/espace/demandes/${r.id}`} className="font-semibold text-primary hover:underline">
                        {r.subject}
                      </Link>
                      <p className="text-sm text-muted">
                        {r.school.name} · {REQUEST_TYPE_LABELS[r.type]} · déposée le {formatDate(r.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        )}
        {showActivity && (
          <Card>
            <CardHeader>
              <CardTitle>Activité récente</CardTitle>
              <Link href="/espace/journal" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                Journal <ArrowRight className="size-4" aria-hidden />
              </Link>
            </CardHeader>
            <CardBody>
              {activity.length === 0 ? (
                <EmptyState title="Aucune activité récente" className="py-6" />
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {activity.map((a) => (
                    <li key={a.id} className="flex items-start justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-text [overflow-wrap:anywhere]">{a.summary}</p>
                        <p className="text-xs text-muted">
                          {a.user ? `${a.user.firstName} ${a.user.lastName}` : "Système"} · {formatDateTime(a.createdAt)}
                        </p>
                      </div>
                      <Badge className="shrink-0">{actionLabel(a.action)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        )}
      </div>

      {links.length > 0 && (
        <nav aria-label="Accès rapides">
          {/* Two per row on a phone, one when the text is enlarged (a column never narrower than 11rem), four from lg. */}
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,11rem),1fr))] gap-3 *:min-w-0 lg:grid-cols-4">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="flex h-full min-h-14 items-center gap-3 rounded-card border border-border bg-surface p-3 text-sm leading-snug font-semibold hover:border-primary sm:p-4 sm:text-base break-words hyphens-auto">
                  <l.icon className="size-5 shrink-0 text-primary" aria-hidden />
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}

function childHref(stats: ScopeStatistics, id: string, user: User) {
  switch (stats.childLevel) {
    case "DEPARTMENT":
      return can(user, "territory:view") ? `/espace/territoire/${id}` : undefined;
    case "COMMUNE":
      return can(user, "territory:view") ? `/espace/territoire/commune/${id}` : undefined;
    case "SCHOOL":
      return can(user, "school:view") ? `/espace/etablissements/${id}` : undefined;
    case "CLASS":
      return undefined;
  }
}

function ComparisonCard({ stats, indicator, title, user }: { stats: ScopeStatistics; indicator: IndicatorKey; title: string; user: User }) {
  const labels = CHILD_LABELS[stats.childLevel];
  const rows = sortByIndicator(stats.children, indicator, "desc")
    .filter((r) => r.indicators[indicator] !== null)
    .slice(0, 12);
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {title} par {labels.singular.toLowerCase()}
        </CardTitle>
      </CardHeader>
      <CardBody>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">Pas encore de données pour cet indicateur.</p>
        ) : (
          <BarChart
            label={`${title} par ${labels.singular.toLowerCase()}`}
            max={indicator === "absenceRate" ? ABSENCE_SCALE : 1}
            format={indicatorFormatter(indicator)}
            scale={
              indicator === "absenceRate"
                ? `Échelle de 0 à 20 %, en rouge au-delà de 10 %. Ensemble du périmètre : ${formatIndicator("absenceRate", stats.total.absenceRate)}.`
                : `Échelle de 0 à 100 %, en rouge sous 50 %. Ensemble du périmètre : ${formatIndicator("passRate", stats.total.passRate)}.`
            }
            data={rows.map((r) => {
              const value = r.indicators[indicator] as number;
              return {
                label: r.name,
                value,
                href: childHref(stats, r.id, user),
                tone: indicator === "absenceRate" ? absenceTone(value) : value < 0.5 ? "danger" : "primary",
              };
            })}
          />
        )}
        {stats.children.length > 12 && <p className="mt-3 text-xs text-muted">Les 12 premiers sur {stats.children.length}. La liste complète est dans Statistiques.</p>}
      </CardBody>
    </Card>
  );
}
