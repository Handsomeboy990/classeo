import { Wallet } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/kit/states";
import { SpokenSummary } from "@/features/family/components/blocks";
import { FeesPayLink } from "@/features/family/components/fees-pay-link";
import { InvoiceCard } from "@/features/family/components/sections";
import { feeNotices, invoicesOf, requireStudentSection } from "@/features/family/queries";
import { FREE_PRIMARY_MESSAGE, NO_BLOCKING_NOTICE } from "@/lib/domain/free-schooling";
import { formatDate, formatFcfa } from "@/lib/utils";

export const metadata: Metadata = { title: "Frais de scolarité" };

// Payments are recorded by the school; a parent pays from /espace/payer.
export default async function FeesPage({ params }: PageProps<"/espace/suivi/[studentId]/frais">) {
  const { studentId } = await params;
  const { user, enrollment } = await requireStudentSection(studentId, "frais");
  const [invoices, notices] = await Promise.all([invoicesOf(enrollment), feeNotices(enrollment)]);
  const exemptions = notices.exemptions.length ? (
    <ul className="flex flex-col gap-2">
      {notices.exemptions.map((e) => (
        <li key={e.name} className="flex flex-wrap items-baseline justify-between gap-2 rounded-card border border-border bg-surface p-4">
          <span className="font-semibold">{e.name}</span>
          <span className="text-sm text-muted">{e.label}</span>
        </li>
      ))}
    </ul>
  ) : null;

  if (!invoices.length) {
    return (
      <div className="flex flex-col gap-5">
        {exemptions}
        <EmptyState
          className="rounded-card border border-border bg-surface"
          icon={<Wallet className="size-7" />}
          title="Aucune facture pour cette année"
          description={notices.free ? FREE_PRIMARY_MESSAGE : `${enrollment.school.name} n'a émis aucune facture pour ${enrollment.student.firstName} en ${enrollment.academicYear.label}.`}
        />
      </div>
    );
  }

  const total = invoices.reduce((n, i) => n + i.totalAmount, 0);
  const paid = invoices.reduce((n, i) => n + i.paidAmount, 0);
  const nextDue = invoices
    .flatMap((i) => i.installments)
    .filter((t) => t.paidAmount < t.amount)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];
  const text = [
    `Frais de scolarité de ${enrollment.student.firstName}.`,
    `Total : ${formatFcfa(total)}. Déjà payé : ${formatFcfa(paid)}. Reste : ${formatFcfa(total - paid)}.`,
    nextDue ? `Prochaine échéance : ${formatFcfa(nextDue.amount - nextDue.paidAmount)} avant le ${formatDate(nextDue.dueDate)}.` : "Tout est payé. Merci.",
  ].join(" ");

  return (
    <div className="flex flex-col gap-5">
      <SpokenSummary text={text} label="Écouter les frais" />
      <FeesPayLink invoices={invoices} isGuardian={!!user.guardianId} />
      {exemptions}
      {invoices.map((i) => (
        <InvoiceCard key={i.id} invoice={i} />
      ))}
      <p className="text-sm text-muted">Vous pouvez aussi payer au secrétariat de l&apos;établissement. Le reçu apparaît ici après enregistrement.</p>
      <p className="text-sm text-muted">{NO_BLOCKING_NOTICE}</p>
    </div>
  );
}
