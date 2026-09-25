import { CalendarRange, FilePlus2, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import type { Metadata } from "next";

import { ConfirmButton } from "@/components/kit/confirm-button";
import { FormDialog } from "@/components/kit/form-dialog";
import { PageHeader } from "@/components/kit/page-header";
import { EmptyState } from "@/components/kit/states";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireFeeStaff } from "@/features/fees/access";
import { createFeeType, deleteFeeType, deletePlan, savePlan, updateFeeType } from "@/features/fees/actions";
import { FeeTypeFields } from "@/features/fees/components/fee-type-form";
import { FeesNav } from "@/features/fees/components/fees-nav";
import { PlanFields } from "@/features/fees/components/plan-form";
import { feesTabs } from "@/features/fees/nav";
import { getFeeTypes, type FeeTypeRow } from "@/features/fees/queries";
import { can } from "@/lib/auth/authorize";
import type { CurrentUser } from "@/lib/auth/session";
import { splitByPlan } from "@/lib/domain/payments";
import { formatDate, formatFcfa, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Types de frais et échéanciers" };

export default async function FeeTypesPage() {
  const user = await requireFeeStaff("fee:view");
  const { year, feeTypes, levels } = await getFeeTypes(user);
  const canCreate = can(user, "fee:create") && !!user.scope.schoolId;

  return (
    <>
      <PageHeader
        title="Types de frais et échéanciers"
        description={`Frais facturés par l'établissement${year ? ` en ${year.label}` : ""} et leurs tranches de paiement.`}
        actions={
          canCreate ? (
            <FormDialog
              action={createFeeType}
              trigger={
                <>
                  <Plus aria-hidden /> Nouveau type de frais
                </>
              }
              title="Nouveau type de frais"
              description={year ? `Année scolaire ${year.label}` : undefined}
              submitLabel="Créer le type de frais"
            >
              <FeeTypeFields levels={levels} />
            </FormDialog>
          ) : null
        }
      />
      <FeesNav items={feesTabs(user)} />

      {feeTypes.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Tags className="size-7" />}
            title="Aucun type de frais pour cette année"
            description={canCreate ? "Commencez par la contribution scolaire : son montant, puis ses tranches." : "L'établissement n'a encore défini aucun frais."}
          />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 *:min-w-0 lg:grid-cols-2">
          {feeTypes.map((ft) => (
            <li key={ft.id}>
              <FeeTypeCard feeType={ft} levels={levels} user={user} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function FeeTypeCard({ feeType: ft, levels, user }: { feeType: FeeTypeRow; levels: { id: string; name: string }[]; user: NonNullable<CurrentUser> }) {
  const plan = ft.plans[0];
  const shares = plan ? splitByPlan(ft.amount, plan.installments.map((i) => i.percent)) : null;
  const invoiced = ft._count.items;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="min-w-0">
          <h2 className="text-lg font-bold">{ft.name}</h2>
          <p className="text-sm text-muted">
            {ft.level ? `Niveau ${ft.level.name}` : "Tous les niveaux"} · {ft.school.name}
          </p>
        </div>
        <p className="shrink-0 font-display text-xl font-bold tabular-nums">{formatFcfa(ft.amount)}</p>
      </CardHeader>
      <CardBody className="flex flex-1 flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone={ft.isActive ? "success" : "neutral"}>{ft.isActive ? "Actif" : "Désactivé"}</Badge>
          <Badge tone={invoiced ? "info" : "neutral"}>{invoiced ? `${formatNumber(invoiced)} facture${invoiced > 1 ? "s émises" : " émise"}` : "Pas encore facturé"}</Badge>
        </div>

        <section aria-label={`Échéancier de ${ft.name}`}>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <CalendarRange className="size-4 text-muted" aria-hidden /> {plan ? plan.name : "Paiement en une fois (pas d'échéancier)"}
          </h3>
          {plan && (
            <ol className="mt-2 divide-y divide-border rounded-lg border border-border text-sm">
              {plan.installments.map((i, k) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="font-medium">
                    {i.label} <span className="text-muted">· {i.percent} %</span>
                  </span>
                  <span className="text-muted">
                    {formatFcfa(shares![k]!)} avant le {formatDate(i.dueDate)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Phone: one full width action per row, within thumb reach. */}
        <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4 max-sm:*:w-full sm:flex-row sm:flex-wrap">
          {can(user, "fee:create") && ft.isActive && (
            <ButtonLink href={`/espace/frais/types/${ft.id}/facturer`} size="sm">
              <FilePlus2 aria-hidden /> Générer les factures
            </ButtonLink>
          )}
          {can(user, "fee:update") && (
            <>
              <FormDialog
                action={savePlan}
                variant="secondary"
                size="sm"
                wide
                trigger={
                  <>
                    <CalendarRange aria-hidden /> {plan ? "Modifier l'échéancier" : "Ajouter un échéancier"}
                  </>
                }
                title={`Échéancier : ${ft.name}`}
                description={`Montant à répartir : ${formatFcfa(ft.amount)}. Les parts doivent faire 100 %.`}
                submitLabel="Enregistrer l'échéancier"
              >
                <PlanFields
                  feeTypeId={ft.id}
                  amount={ft.amount}
                  initial={
                    plan
                      ? { id: plan.id, name: plan.name, installments: plan.installments.map((i) => ({ label: i.label, percent: i.percent, dueDate: i.dueDate.toISOString().slice(0, 10) })) }
                      : undefined
                  }
                />
              </FormDialog>
              <FormDialog
                action={updateFeeType}
                variant="ghost"
                size="sm"
                trigger={
                  <>
                    <Pencil aria-hidden /> Modifier
                  </>
                }
                title={`Modifier : ${ft.name}`}
              >
                <FeeTypeFields levels={levels} initial={{ id: ft.id, name: ft.name, amount: ft.amount, levelId: ft.levelId, isActive: ft.isActive }} />
              </FormDialog>
            </>
          )}
          {can(user, "fee:update") && plan && (
            <ConfirmButton
              action={deletePlan}
              fields={{ id: plan.id }}
              title={`Supprimer l'échéancier « ${plan.name} » ?`}
              description="Les prochaines factures de ce type seront payables en une fois. Les factures déjà émises gardent leurs tranches."
              confirmLabel="Supprimer l'échéancier"
              variant="danger-ghost"
              size="sm"
            >
              <Trash2 aria-hidden /> Supprimer l&apos;échéancier
            </ConfirmButton>
          )}
          {can(user, "fee:delete") && (
            <ConfirmButton
              action={deleteFeeType}
              fields={{ id: ft.id }}
              title={`Supprimer « ${ft.name} » ?`}
              description="Le type de frais et son échéancier seront supprimés. Un type de frais déjà facturé ne peut pas être supprimé : désactivez-le."
              confirmLabel="Supprimer"
              variant="danger-ghost"
              size="sm"
            >
              <Trash2 aria-hidden /> Supprimer
            </ConfirmButton>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
