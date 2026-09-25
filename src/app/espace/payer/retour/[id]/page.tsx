import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/kit/page-header";
import { ReturnStatus } from "@/features/online-payment/components/return-status";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Paiement en ligne" };

// The page the provider sends the payer back to. Its own query string
// (?id=&status=) is ignored: the state comes from our record, updated by
// the signed webhook or read from the provider's API.
export default async function ReturnPage({ params }: PageProps<"/espace/payer/retour/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const op = await db.onlinePayment.findFirst({ where: { id, payerId: user.id }, select: { id: true, status: true, amount: true, invoiceId: true, paymentId: true } });
  if (!op) notFound();
  const payment = op.paymentId ? await db.payment.findUnique({ where: { id: op.paymentId }, select: { id: true, reference: true } }) : null;
  return (
    <>
      <PageHeader title="Paiement en ligne" />
      <div className="max-w-2xl">
        <ReturnStatus id={op.id} initial={{ status: op.status, amount: op.amount, invoiceId: op.invoiceId, payment }} />
      </div>
    </>
  );
}
