import { ArrowRight, BarChart3, ChevronRight, Inbox, KeyRound, Landmark, Map, ScrollText, ShieldCheck, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { roleLabel } from "@/features/messages/role-label";
import { BarChart } from "@/components/kit/bar-chart";
import { DonutChart } from "@/components/kit/donut-chart";
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
import { formatDate, formatDateTime, formatPercent } from "@/lib/utils";

import { userStatScope } from "../territory/scope";
import { IndicatorCards } from "./components/indicator-cards";
import { ABSENCE_SCALE, absenceTone, indicatorFormatter } from "./format";
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
    { href: "/espace/territoire", label: "Territoire", body: "Départements, communes et leurs indicateurs.", icon: Map, show: can(user, "territory:view") && user.scope.level !== "SCHOOL" },
    { href: "/espace/statistiques", label: "Statistiques détaillées", body: "Chiffres clés, comparaisons et exports.", icon: BarChart3, show: showStats },
    { href: "/espace/etablissements", label: "Établissements", body: "Écoles, collèges et lycées du périmètre.", icon: Landmark, show: can(user, "school:view") && user.scope.level !== "SCHOOL" },
    { href: `/espace/etablissements/${user.scope.schoolId}`, label: "Fiche de l'établissement", body: "Identité, direction, classes et personnel.", icon: Landmark, show: can(user, "school:view") && user.scope.level === "SCHOOL" },
    { href: "/espace/demandes", label: "Demandes", body: "Demandes adressées et leurs décisions.", icon: Inbox, show: showRequests },
    { href: "/espace/utilisateurs", label: "Comptes utilisateurs", body: "Créer, suspendre et réinitialiser les comptes.", icon: KeyRound, show: can(user, "user:view") },
    { href: "/espace/droits", label: "Rôles et droits", body: "Ce que chaque rôle peut voir et faire.", icon: ShieldCheck, show: can(user, "role:view") },
    { href: "/espace/journal", label: "Journal d'activité", body: "Qui a fait quoi, et quand.", icon: ScrollText, show: showActivity },
  ].filter((l) => l.show);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Bonjour, ${user.firstName}`} description={`${roleLabel(user.role.name, user.gender)} · ${user.scope.label} · Année scolaire ${years.current?.label ?? ""}`} />

      {stats && <IndicatorCards stats={stats} requestsHref={showRequests ? "/espace/demandes?statut=PENDING" : undefined} />}

      {stats && stats.children.length > 0 && (
        <div className="grid gap-4 *:min-w-0 lg:grid-cols-2">
          <ComparisonCard stats={stats} indicator="passRate" title={`Taux de réussite ${stats.previousYearLabel ?? ""}`} user={user} />
          <ComparisonCard stats={stats} indicator="absenceRate" title="Taux d'absence cette année" user={user} />
        </div>
      )}

      {stats && stats.total.enrollments > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Élèves inscrits cette année</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-6 md:grid-cols-2">
            <DonutChart
              label="Filles et garçons parmi les élèves inscrits"
              total="élèves"
              data={[
                { label: "Filles", value: stats.total.girls },
                { label: "Garçons", value: stats.total.enrollments - stats.total.girls },
              ]}
            />
            <DonutChart
              label="Élèves en situation de handicap"
              total="élèves"
              data={[
                { label: "En situation de handicap", value: stats.total.disabled, color: "var(--chart-2)" },
                { label: "Autres élèves", value: stats.total.enrollments - stats.total.disabled, color: "var(--chart-5)" },
              ]}
            />
          </CardBody>
        </Card>
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
        <nav aria-labelledby="shortcuts-title" className="flex flex-col gap-3">
          <h2 id="shortcuts-title" className="text-lg font-bold">
            Accès rapides
          </h2>
          {/* As many columns as tiles of 15rem fit, at every text size: one
              on a phone, four on a large screen at the usual size, fewer
              when the text is enlarged. */}
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))] gap-3 *:min-w-0 sm:gap-4">
            {links.map((l) => (
              <ShortcutTile key={l.href} {...l} />
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}

// Service tile (doc 4.4): the same soft navy pastille for every shortcut,
// the title is the link and the whole tile answers the pointer. Words are
// never cut: when the longest one does not fit beside the pastille, the
// text goes under it.
function ShortcutTile({ href, label, body, icon: Icon }: { href: string; label: string; body: string; icon: LucideIcon }) {
  return (
    <li className="relative flex flex-wrap gap-3.5 rounded-card border border-border bg-surface p-4 shadow-card transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-[var(--elevation-sm)] has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-focus lg:p-5">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary" aria-hidden>
        <Icon className="size-6" />
      </span>
      <div className="flex min-w-min grow basis-0 flex-col">
        <p className="font-display text-base leading-snug font-bold text-balance break-normal wrap-normal hyphens-manual text-text">
          <Link href={href} className="outline-none! after:absolute after:inset-0 after:rounded-card">
            {label}
          </Link>
        </p>
        <p className="mt-1 text-sm leading-snug text-pretty text-muted">{body}</p>
        <span aria-hidden className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-link">
          Accéder
          <ChevronRight className="size-4" />
        </span>
      </div>
    </li>
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
            tickFormat={(n) => formatPercent(n)}
            reference={stats.total[indicator] !== null ? { value: stats.total[indicator] as number, label: "Ensemble du périmètre" } : undefined}
            scale={indicator === "absenceRate" ? "Échelle de 0 à 20 %, en rouge au-delà de 10 %." : "Échelle de 0 à 100 %, en rouge sous 50 %."}
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
