import { Landmark, Smartphone } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/kit/page-header";
import { EmptyState } from "@/components/kit/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { requireFeeStaff } from "@/features/fees/access";
import { FeesNav } from "@/features/fees/components/fees-nav";
import { feesTabs } from "@/features/fees/nav";
import { AddAccountButton, ToggleAccountButton } from "@/features/online-payment/components/staff-controls";
import { paymentAccounts } from "@/features/online-payment/queries";
import { can } from "@/lib/auth/authorize";

export const metadata: Metadata = { title: "Comptes de paiement" };

export default async function PaymentAccountsPage() {
  const user = await requireFeeStaff("fee:view");
  const accounts = await paymentAccounts(user);
  const canEdit = can(user, "fee:update") && !!user.scope.schoolId;

  return (
    <>
      <PageHeader
        title="Comptes de paiement"
        description="Numéros Mobile Money et comptes bancaires où les parents envoient les frais. Sans compte actif, la page de paiement leur indique de régler à l'établissement."
        actions={canEdit ? <AddAccountButton /> : null}
      />
      <FeesNav items={feesTabs(user)} />
      {accounts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Smartphone className="size-7" />}
            title="Aucun compte de paiement"
            description="Ajoutez le numéro Mobile Money ou le compte bancaire de l'établissement pour que les parents puissent payer à distance."
            action={canEdit ? <AddAccountButton /> : null}
          />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {accounts.map((a) => (
            <li key={a.id}>
              <Card className={a.isActive ? "" : "opacity-75"}>
                <CardBody className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 font-semibold">
                      {a.channel === "BANK" ? <Landmark className="size-4 text-primary" aria-hidden /> : <Smartphone className="size-4 text-primary" aria-hidden />}
                      {a.provider}
                    </p>
                    <Badge tone={a.isActive ? "success" : "neutral"}>{a.isActive ? "Proposé aux parents" : "Désactivé"}</Badge>
                  </div>
                  <p className="font-mono text-lg font-bold tracking-wide break-all">{a.accountNumber}</p>
                  <p className="text-sm text-muted">Au nom de {a.accountName}</p>
                  {a.instructions && <p className="text-sm">{a.instructions}</p>}
                  {canEdit && (
                    <div className="pt-1">
                      <ToggleAccountButton id={a.id} active={a.isActive} label={`${a.provider} ${a.accountNumber}`} />
                    </div>
                  )}
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
