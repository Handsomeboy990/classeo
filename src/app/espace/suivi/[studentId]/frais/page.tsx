import { Wallet } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/kit/states";
import { SpokenSummary } from "@/features/family/components/blocks";
import { InvoiceCard } from "@/features/family/components/sections";
import { invoicesOf, requireStudentSection } from "@/features/family/queries";
import { formatDate, formatFcfa } from "@/lib/utils";

export const metadata: Metadata = { title: "Frais de scolarité" };

// Read only: payments are recorded by the school's accountant.
export default async function FeesPage({ params }: PageProps<"/espace/suivi/[studentId]/frais">) {
  const { studentId } = await params;
  const { enrollment } = await requireStudentSection(studentId, "frais");
  const invoices = await invoicesOf(enrollment);

  if (!invoices.length) {
    return (
      <EmptyState
        className="rounded-card border border-border bg-surface"
        icon={<Wallet className="size-7" />}
        title="Aucune facture pour cette année"
        description={`${enrollment.school.name} n'a émis aucune facture pour ${enrollment.student.firstName} en ${enrollment.academicYear.label}.`}
      />
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
      {invoices.map((i) => (
        <InvoiceCard key={i.id} invoice={i} />
      ))}
      <p className="text-sm text-muted">Pour payer, rendez-vous au secrétariat de l&apos;établissement ou utilisez le paiement Mobile Money indiqué par l&apos;école. Le reçu apparaît ici après enregistrement.</p>
    </div>
  );
}
