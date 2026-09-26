import { Activity, Download, KeyRound, LogIn, ShieldAlert, UserPlus, Users } from "lucide-react";
import type { Metadata } from "next";

import { BarChart } from "@/components/kit/bar-chart";
import { DataTable, type Column } from "@/components/kit/data-table";
import { DonutChart } from "@/components/kit/donut-chart";
import { InfoTip } from "@/components/kit/info-tip";
import { LineChart } from "@/components/kit/line-chart";
import { PageHeader } from "@/components/kit/page-header";
import { StatCard, StatGrid } from "@/components/kit/stat-card";
import { EmptyState } from "@/components/kit/states";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { displayIp } from "@/features/connections/ip";
import { connectionFilterOptions, connectionOverview, recentConnections, visitOverview } from "@/features/connections/queries";
import { connectionFilters, OUTCOME_LABELS, OUTCOMES, PERIODS, type Outcome } from "@/features/connections/scope";
import { DEVICE_LABELS, type DeviceKind } from "@/features/connections/user-agent";
import { LANGUAGE_LABELS, type VisitLanguage } from "@/features/connections/visits";
import { FilterBar } from "@/features/territory/components/filter-bar";
import { can, requirePermission } from "@/lib/auth/authorize";
import { listParams } from "@/lib/list";
import { formatDateTime, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Connexions et fréquentation" };

const OUTCOME_TONES: Record<Outcome, "success" | "warning" | "danger" | "info" | "neutral"> = {
  SUCCESS: "success",
  WRONG_PASSWORD: "warning",
  LOCKED: "danger",
  DISABLED: "danger",
  UNKNOWN_ACCOUNT: "warning",
  RATE_LIMITED: "danger",
  SIGN_OUT: "neutral",
};

const AUDIENCE_LABELS: Record<string, string> = { public: "Pages publiques", signed_in: "Espace connecté" };

// "2026-09-12" as "12/09".
const shortDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
const deviceLabel = (d: string | null) => (d ? (DEVICE_LABELS[d as DeviceKind] ?? d) : "Inconnu");

type Recent = Awaited<ReturnType<typeof recentConnections>>["rows"][number];

// Sign ins of the viewer's territory and chain (features/connections/scope.ts),
// and, for national accounts, the page views of the platform. IP addresses
// are truncated without connection_ip:view.
export default async function ConnectionsPage({ searchParams }: PageProps<"/espace/statistiques/connexions">) {
  const user = await requirePermission("connection:view");
  const sp = await searchParams;
  const filters = connectionFilters(sp, user.scope.level);
  const fullIp = can(user, "connection_ip:view");
  const national = user.scope.level === "NATIONAL";
  const page = listParams(sp, 25);

  const [overview, recent, options, visits] = await Promise.all([
    connectionOverview(user, filters, { fullIp }),
    recentConnections(user, filters, page),
    connectionFilterOptions(user),
    national ? visitOverview(filters.days) : Promise.resolve(null),
  ]);
  const t = overview.totals;
  const labels = overview.perDay.map((d) => shortDay(d.day));

  const exportQuery = new URLSearchParams();
  for (const k of ["periode", "role", "departement", "resultat"]) {
    const v = sp[k];
    if (typeof v === "string" && v) exportQuery.set(k, v);
  }

  const columns: Column<Recent>[] = [
    { header: "Date", cell: (r) => <span className="whitespace-nowrap tabular-nums">{formatDateTime(r.createdAt)}</span> },
    {
      header: "Compte",
      primary: true,
      cell: (r) =>
        r.user ? (
          <div>
            <p className="font-semibold">
              {r.user.firstName} {r.user.lastName}
            </p>
            <p className="text-xs text-muted">{r.user.role.name}</p>
          </div>
        ) : (
          <span className="text-muted">Identifiant inconnu</span>
        ),
    },
    {
      header: "Résultat",
      cell: (r) => (
        <span className="flex flex-wrap gap-1">
          <Badge tone={OUTCOME_TONES[r.outcome]}>{OUTCOME_LABELS[r.outcome]}</Badge>
          {r.firstTime && <Badge tone="info">Première connexion</Badge>}
          {r.demo && <Badge tone="neutral">Démonstration</Badge>}
        </span>
      ),
    },
    { header: "Territoire", cell: (r) => <span className="text-sm">{[r.commune, r.department].filter(Boolean).join(", ") || "–"}</span>, hideBelow: "md" },
    { header: "Appareil", cell: (r) => <span className="text-sm">{[deviceLabel(r.device), r.browser, r.os].filter(Boolean).join(" · ")}</span>, hideBelow: "lg" },
    { header: "Adresse IP", cell: (r) => <span className="font-mono text-xs text-muted" data-testid="recent-ip">{displayIp(r.ip, fullIp)}</span>, hideBelow: "sm" },
  ];

  const scopeText = national
    ? user.scope.chain
      ? "Connexions des comptes de votre ordre d'enseignement, sur tout le territoire."
      : "Connexions de tous les comptes de la plateforme, sur tout le territoire."
    : "Connexions des comptes de votre département et de votre ordre d'enseignement.";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Connexions et fréquentation"
        description={`${user.scope.label} · ${filters.days} derniers jours`}
        info={
          <>
            {scopeText} Chaque tentative de connexion est enregistrée avec son résultat, l&apos;appareil et l&apos;adresse IP. Les adresses complètes sont conservées 90 jours,
            puis tronquées ; les connexions sont effacées après 13 mois.
            {fullIp ? "" : " Les adresses IP sont affichées tronquées (par exemple 196.47.x.x)."}
          </>
        }
        infoSize="lg"
        actions={
          can(user, "connection:export") ? (
            <ButtonLink href={`/api/export/connexions${exportQuery.size ? `?${exportQuery}` : ""}`} variant="secondary" prefetch={false}>
              <Download aria-hidden /> Exporter en CSV
            </ButtonLink>
          ) : null
        }
      />

      <FilterBar
        basePath="/espace/statistiques/connexions"
        fields={[
          { kind: "select", name: "periode", label: "Période", value: sp.periode ? String(filters.days) : null, allLabel: "30 derniers jours", options: PERIODS.filter((p) => p !== 30).map((p) => ({ value: String(p), label: `${p} derniers jours` })) },
          { kind: "select", name: "role", label: "Rôle", value: filters.role, allLabel: "Tous les rôles", options: options.roles.map((r) => ({ value: r.code, label: r.name })) },
          ...(national
            ? [{ kind: "select" as const, name: "departement", label: "Département", value: filters.departmentId, allLabel: "Tout le Bénin", options: options.departments.map((d) => ({ value: d.id, label: d.name })) }]
            : []),
          { kind: "select", name: "resultat", label: "Résultat", value: filters.outcome, allLabel: "Tous", options: OUTCOMES.map((o) => ({ value: o, label: OUTCOME_LABELS[o] })) },
        ]}
      />

      <StatGrid>
        <StatCard label="Connexions réussies" value={formatNumber(t.success)} icon={LogIn} hint={t.demo ? `dont ${formatNumber(t.demo)} depuis la page de démonstration` : undefined} />
        <StatCard label="Utilisateurs actifs" value={formatNumber(t.users)} icon={Users} tone="info" hint="comptes différents connectés" />
        <StatCard label="Premières connexions" value={formatNumber(t.firstTime)} icon={UserPlus} tone="accent" />
        <StatCard label="Échecs de connexion" value={formatNumber(t.failed)} icon={ShieldAlert} tone="warning" hint={`${formatNumber(t.lockedNow)} compte${t.lockedNow > 1 ? "s" : ""} verrouillé${t.lockedNow > 1 ? "s" : ""} en ce moment`} />
      </StatGrid>

      <Card>
        <CardHeader>
          <CardTitle>Connexions par jour</CardTitle>
        </CardHeader>
        <CardBody>
          <LineChart
            label="Connexions réussies et échecs par jour"
            labels={labels}
            series={[
              { name: "Connexions réussies", values: overview.perDay.map((d) => d.success) },
              { name: "Utilisateurs actifs", values: overview.perDay.map((d) => d.users) },
              { name: "Échecs", values: overview.perDay.map((d) => d.failed), color: "var(--chart-danger)" },
            ]}
            empty="Aucune connexion sur la période."
          />
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Utilisateurs actifs par rôle</CardTitle>
          </CardHeader>
          <CardBody>
            <BarChart label="Utilisateurs actifs par rôle" data={overview.byRole.map((r) => ({ label: r.label, value: r.value }))} empty="Aucun utilisateur actif sur la période." />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Utilisateurs actifs par {overview.placeLevel === "department" ? "département" : "commune"}</CardTitle>
          </CardHeader>
          <CardBody>
            <BarChart label={`Utilisateurs actifs par ${overview.placeLevel === "department" ? "département" : "commune"}`} data={overview.byPlace.map((r) => ({ label: r.label, value: r.value }))} empty="Aucun utilisateur actif sur la période." />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Résultats des tentatives</CardTitle>
          </CardHeader>
          <CardBody>
            <BarChart
              label="Tentatives de connexion par résultat"
              data={overview.byOutcome.map((r) => ({ label: OUTCOME_LABELS[r.key as Outcome] ?? String(r.key), value: r.value, tone: r.key === "SUCCESS" || r.key === "SIGN_OUT" ? "primary" : "danger" }))}
              empty="Aucune tentative sur la période."
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Appareils</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-6">
            <DonutChart label="Connexions réussies par appareil" total="connexions" data={overview.devices.map((d) => ({ label: deviceLabel(d.key), value: d.value }))} />
            <div className="grid gap-6 sm:grid-cols-2">
              <BarChart label="Navigateurs" data={overview.browsers.map((d) => ({ label: d.key ?? "Inconnu", value: d.value }))} />
              <BarChart label="Systèmes" data={overview.systems.map((d) => ({ label: d.key ?? "Inconnu", value: d.value }))} />
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <CardTitle>Adresses IP les plus fréquentes</CardTitle>
          <InfoTip label="À propos des adresses IP">
            Une même adresse peut regrouper plusieurs personnes (un établissement, un cybercafé, un opérateur mobile). Beaucoup d&apos;échecs depuis une même adresse peuvent signaler
            une tentative d&apos;intrusion.{fullIp ? "" : " Les adresses sont tronquées : l'adresse complète est réservée à l'administration nationale."}
          </InfoTip>
        </CardHeader>
        <CardBody>
          {overview.topIps.length ? (
            <Table>
              <caption className="sr-only">Adresses IP les plus fréquentes sur la période</caption>
              <THead>
                <TR>
                  <TH>Adresse IP</TH>
                  <TH className="text-right">Tentatives</TH>
                  <TH className="text-right">Échecs</TH>
                  <TH className="text-right">Comptes</TH>
                </TR>
              </THead>
              <tbody>
                {overview.topIps.map((r) => (
                  <TR key={r.ip}>
                    <TD className="font-mono text-sm" data-testid="top-ip">
                      {r.ip}
                    </TD>
                    <TD className="text-right tabular-nums">{formatNumber(r.count)}</TD>
                    <TD className="text-right tabular-nums">{formatNumber(r.failed)}</TD>
                    <TD className="text-right tabular-nums">{formatNumber(r.users)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState title="Aucune adresse sur la période." className="py-8" />
          )}
        </CardBody>
      </Card>

      <section aria-labelledby="recent-title" className="flex flex-col gap-3">
        <h2 id="recent-title" className="flex items-center gap-2 text-lg font-bold">
          <KeyRound className="size-5 text-muted" aria-hidden /> Connexions récentes
        </h2>
        <DataTable
          rows={recent.rows}
          columns={columns}
          rowKey={(r) => r.id}
          total={recent.total}
          page={page.page}
          pageSize={page.pageSize}
          searchParams={sp}
          basePath="/espace/statistiques/connexions"
          searchPlaceholder={false}
          caption="Connexions récentes, de la plus récente à la plus ancienne"
          emptyTitle="Aucune connexion"
          emptyDescription="Aucune connexion ne correspond à ces critères dans votre périmètre."
        />
      </section>

      {visits && (
        <section aria-labelledby="visits-title" className="flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <h2 id="visits-title" className="flex items-center gap-2 text-lg font-bold">
              <Activity className="size-5 text-muted" aria-hidden /> Fréquentation des pages
            </h2>
            <InfoTip label="À propos de la fréquentation" size="lg">
              Mesure interne, sans cookie ni identifiant : chaque page affichée ajoute un au compteur du jour de la page, de sa langue, du type d&apos;appareil et du site
              d&apos;origine. Aucune visite n&apos;est conservée une à une. Les navigateurs qui demandent de ne pas être suivis (Do Not Track, Global Privacy Control) ne sont
              pas comptés.
            </InfoTip>
          </div>
          <StatGrid>
            <StatCard label="Pages vues" value={formatNumber(visits.total)} icon={Activity} />
            {visits.audience.map((a) => (
              <StatCard key={a.key} label={AUDIENCE_LABELS[a.key] ?? a.key} value={formatNumber(a.value)} tone="info" />
            ))}
          </StatGrid>
          <Card>
            <CardHeader>
              <CardTitle>Pages vues par jour</CardTitle>
            </CardHeader>
            <CardBody>
              <LineChart
                label="Pages vues par jour, pages publiques et espace connecté"
                labels={visits.perDay.map((d) => shortDay(d.day))}
                series={[
                  { name: "Pages publiques", values: visits.perDay.map((d) => d.public) },
                  { name: "Espace connecté", values: visits.perDay.map((d) => d.signedIn) },
                ]}
                empty="Aucune page vue sur la période."
              />
            </CardBody>
          </Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Pages les plus vues</CardTitle>
              </CardHeader>
              <CardBody>
                <BarChart label="Pages les plus vues" data={visits.pages.map((p) => ({ label: p.key, value: p.value }))} empty="Aucune page vue sur la période." />
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Sites d&apos;origine</CardTitle>
              </CardHeader>
              <CardBody>
                <BarChart label="Sites d'origine des visiteurs" data={visits.referrers.map((p) => ({ label: p.key === "(direct)" ? "Accès direct" : p.key, value: p.value }))} empty="Aucune visite sur la période." />
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Langues</CardTitle>
              </CardHeader>
              <CardBody>
                <DonutChart label="Pages vues par langue" total="pages vues" data={visits.languages.map((l) => ({ label: LANGUAGE_LABELS[l.key as VisitLanguage] ?? l.key, value: l.value }))} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Appareils des visiteurs</CardTitle>
              </CardHeader>
              <CardBody>
                <DonutChart label="Pages vues par appareil" total="pages vues" data={visits.devices.map((d) => ({ label: deviceLabel(d.key), value: d.value }))} />
              </CardBody>
            </Card>
          </div>
        </section>
      )}
    </div>
  );
}
