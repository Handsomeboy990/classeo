import { AlertTriangle, CheckCircle2, Coins, Percent, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { InfoTip } from "@/components/kit/info-tip";
import { BarChart } from "@/components/kit/bar-chart";
import { PageHeader } from "@/components/kit/page-header";
import { StatCard, StatGrid } from "@/components/kit/stat-card";
import { EmptyState } from "@/components/kit/states";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { requireFeeStaff } from "@/features/fees/access";
import { FeesNav } from "@/features/fees/components/fees-nav";
import { feesTabs } from "@/features/fees/nav";
import { getFeesOverview, getRecentPayments } from "@/features/fees/queries";
import { can } from "@/lib/auth/authorize";
import { PAYMENT_METHOD_LABELS } from "@/lib/domain/payments";
import { formatDate, formatFcfa, formatNumber, formatPercent } from "@/lib/utils";

export const metadata: Metadata = { title: "Frais et paiements" };

export default async function FeesOverviewPage() {
  const user = await requireFeeStaff(["fee:view", "payment:view"]);
  const [{ year, overview }, recent] = await Promise.all([
    getFeesOverview(user),
    can(user, "payment:view") ? getRecentPayments(user) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title="Frais et paiements"
        description={`${year ? `Année ${year.label} · ` : ""}${user.scope.label}`}
        info="Recouvrement des frais scolaires : ce qui est attendu, encaissé et reste à recouvrer, par classe."
        actions={
          can(user, "fee:view") ? (
            <ButtonLink href="/espace/frais/factures" variant="secondary">
              Voir les factures
            </ButtonLink>
          ) : null
        }
      />
      <FeesNav items={feesTabs(user)} />

      {!overview || overview.invoiceCount === 0 ? (
        <Card>
          <EmptyState
            icon={<Wallet className="size-7" />}
            title="Aucune facture pour cette année"
            description="Créez un type de frais, ajoutez son échéancier, puis générez les factures des élèves concernés."
            action={
              can(user, "fee:view") ? (
                <ButtonLink href="/espace/frais/types">Gérer les types de frais</ButtonLink>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <StatGrid>
            <StatCard label="Montant attendu" value={formatFcfa(overview.expected)} hint={`${formatNumber(overview.invoiceCount)} factures`} icon={Coins} />
            <StatCard label="Montant encaissé" value={formatFcfa(overview.collected)} hint={`${formatNumber(overview.paidCount)} factures soldées`} icon={CheckCircle2} tone="info" />
            <StatCard label="Reste à recouvrer" value={formatFcfa(overview.remaining)} icon={Wallet} tone="warning" />
            <StatCard
              label="Taux de recouvrement"
              value={formatPercent(overview.rate)}
              hint={overview.overdueCount ? `${formatNumber(overview.overdueCount)} facture${overview.overdueCount > 1 ? "s" : ""} en retard` : "Aucune facture en retard"}
              icon={overview.overdueCount ? AlertTriangle : Percent}
              tone={overview.overdueCount ? "danger" : "accent"}
              href={overview.overdueCount && can(user, "fee:view") ? "/espace/frais/factures?statut=OVERDUE" : undefined}
            />
          </StatGrid>

          <div className="grid grid-cols-1 gap-6 *:min-w-0 lg:grid-cols-[3fr_2fr]">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-1.5">
                  <CardTitle>Recouvrement par classe</CardTitle>
                  <InfoTip>Part du montant attendu déjà encaissée. En rouge, moins de la moitié.</InfoTip>
                </div>
              </CardHeader>
              <CardBody>
                <BarChart
                  label="Taux de recouvrement par classe"
                  max={100}
                  format={(n) => `${n} %`}
                  data={overview.byClass.map((c) => ({
                    label: c.name,
                    detail: `${formatFcfa(c.collected)} sur ${formatFcfa(c.expected)}`,
                    value: Math.round(c.rate * 100),
                    tone: c.rate < 0.5 ? ("danger" as const) : ("primary" as const),
                    href: can(user, "fee:view") ? `/espace/frais/factures?classe=${c.id}` : undefined,
                  }))}
                />
              </CardBody>
            </Card>

            {can(user, "payment:view") && (
              <Card>
                <CardHeader>
                  <CardTitle>Derniers paiements</CardTitle>
                  <Link href="/espace/frais/paiements" className="text-sm font-semibold text-primary hover:underline">
                    Tout voir
                  </Link>
                </CardHeader>
                {recent.length === 0 ? (
                  <EmptyState title="Aucun paiement enregistré" />
                ) : (
                  <ul className="divide-y divide-border">
                    {recent.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                        <div className="min-w-0">
                          <Link href={`/espace/frais/factures/${p.invoice.id}`} className="block truncate font-semibold text-text hover:underline">
                            {p.invoice.enrollment.student.lastName} {p.invoice.enrollment.student.firstName}
                          </Link>
                          <p className="truncate text-xs text-muted">
                            {p.invoice.enrollment.classroom.name} · {PAYMENT_METHOD_LABELS[p.method]} · {formatDate(p.paidAt)}
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold tabular-nums">{formatFcfa(p.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  );
}
