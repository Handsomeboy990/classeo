import { CheckCircle2, Hourglass, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/kit/page-header";
import { EmptyState } from "@/components/kit/states";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/features/fees/components/status-badge";
import { payerInvoices } from "@/features/online-payment/queries";
import { requireUser } from "@/lib/auth/session";
import type { InvoiceStatusCode } from "@/lib/domain/payments";
import { formatDate, formatFcfa } from "@/lib/utils";

export const metadata: Metadata = { title: "Payer les frais" };

export default async function PayHomePage() {
  const user = await requireUser();
  const invoices = await payerInvoices(user);

  return (
    <>
      <PageHeader title="Payer les frais" info="Les factures de vos enfants pour cette année scolaire. Payez une tranche, plusieurs, ou tout le solde." />
      {invoices.length === 0 ? (
        <Card>
          <EmptyState icon={<Wallet className="size-7" />} title="Aucune facture à payer" description="L'établissement n'a émis aucune facture pour vos enfants cette année." />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {invoices.map((i) => {
            const rest = Math.max(0, i.totalAmount - i.paidAmount);
            const pending = i.declarations.reduce((s, d) => s + d.amount, 0);
            const child = i.enrollment.student;
            return (
              <li key={i.id}>
                <Card className="flex h-full flex-col gap-3 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold">
                        <Link href={`/espace/payer/${i.id}`} className="underline-offset-4 hover:underline">
                          {child.firstName} {child.lastName}
                        </Link>
                      </h2>
                      <p className="text-sm text-muted">
                        {i.enrollment.classroom.name} · {i.school.name} · facture {i.number}
                      </p>
                    </div>
                    <StatusBadge status={i.status as InvoiceStatusCode} />
                  </div>
                  <p className="text-2xl font-bold tabular-nums">
                    {rest > 0 ? formatFcfa(rest) : "Soldée"}
                    {rest > 0 && <span className="ml-2 text-sm font-normal text-muted">reste à payer sur {formatFcfa(i.totalAmount)}</span>}
                  </p>
                  {pending > 0 && (
                    <p className="flex items-center gap-1.5 text-sm text-warning">
                      <Hourglass className="size-4" aria-hidden /> {formatFcfa(pending)} déclaré, en cours de vérification
                    </p>
                  )}
                  <div className="mt-auto">
                    {rest > 0 ? (
                      <ButtonLink href={`/espace/payer/${i.id}`} className="w-full sm:w-auto">
                        <Wallet aria-hidden /> Payer
                      </ButtonLink>
                    ) : (
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-success">
                        <CheckCircle2 className="size-4" aria-hidden /> Tout est payé. Merci.
                      </p>
                    )}
                  </div>
                  {rest > 0 && <p className="text-xs text-muted">Échéance finale : {formatDate(i.dueDate)}. Vous pouvez payer avant, à tout moment.</p>}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
