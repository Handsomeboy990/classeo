import { Wallet } from "lucide-react";

import { InfoTip } from "@/components/kit/info-tip";
import { ButtonLink } from "@/components/ui/button";
import { formatFcfa } from "@/lib/utils";

// Entry to the payment pages from the family fees section: shown to a
// parent while something remains to pay.
export function FeesPayLink({ invoices, isGuardian }: { invoices: { id: string; totalAmount: number; paidAmount: number }[]; isGuardian: boolean }) {
  const open = invoices.filter((i) => i.totalAmount > i.paidAmount);
  if (!isGuardian || !open.length) return null;
  const rest = open.reduce((s, i) => s + i.totalAmount - i.paidAmount, 0);
  return (
    <div className="flex flex-col gap-3 rounded-card border border-primary/20 bg-primary-soft p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex items-center gap-1.5">
        <p className="font-bold">Reste à payer : {formatFcfa(rest)}</p>
        <InfoTip>Payez une tranche, plusieurs ou tout le solde, en ligne ou en déclarant un paiement Mobile Money déjà fait.</InfoTip>
      </div>
      <ButtonLink href={open.length === 1 ? `/espace/payer/${open[0]!.id}` : "/espace/payer"} size="lg" className="shrink-0">
        <Wallet aria-hidden /> Payer
      </ButtonLink>
    </div>
  );
}
