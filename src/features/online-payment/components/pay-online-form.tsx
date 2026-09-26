"use client";

import { Lock, Smartphone } from "lucide-react";
import { useState } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { Checkbox, ChoiceGroup, Input, Radio } from "@/components/ui/input";
import { formatFcfa } from "@/lib/utils";

import { startOnlinePayment } from "../actions";

export type UnpaidInstallment = { id: string; label: string; remaining: number; due: string };

// Online payment: the whole balance or the next installments. Installments
// are paid in order, so ticking one ticks those before it, and unticking
// one unticks those after. The amount shown is a preview: the server
// computes the amount it asks the provider for.
export function PayOnlineForm({ invoiceId, rest, installments, providerLabel, defaultPhone }: { invoiceId: string; rest: number; installments: UnpaidInstallment[]; providerLabel: string; defaultPhone: string }) {
  const [mode, setMode] = useState<"all" | "installments">(installments.length > 1 ? "installments" : "all");
  const [count, setCount] = useState(1);
  const [phone, setPhone] = useState(defaultPhone);
  const [leaving, setLeaving] = useState(false);
  const chosen = mode === "all" ? installments : installments.slice(0, count);
  const amount = mode === "all" ? rest : Math.min(rest, chosen.reduce((s, i) => s + i.remaining, 0));

  return (
    <ActionForm
      action={startOnlinePayment}
      successToast={false}
      onSuccess={(state) => {
        const url = (state?.data as { url?: string } | undefined)?.url;
        if (url) {
          setLeaving(true);
          window.location.assign(url);
        }
      }}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="invoiceId" value={invoiceId} />
      {installments.length > 1 ? (
        <ChoiceGroup legend="Que voulez-vous payer ?">
          <Radio name="mode" value="installments" checked={mode === "installments"} onChange={() => setMode("installments")} label="Une ou plusieurs tranches" description="Dans l'ordre des échéances." />
          <Radio name="mode" value="all" checked={mode === "all"} onChange={() => setMode("all")} label={`Tout le solde, ${formatFcfa(rest)}`} />
        </ChoiceGroup>
      ) : (
        <input type="hidden" name="mode" value="all" />
      )}

      {mode === "installments" && (
        <ChoiceGroup legend="Tranches à payer" info="Une tranche se paie après celles qui la précèdent.">
          {installments.map((t, i) => (
            <Checkbox
              key={t.id}
              checked={i < count}
              onChange={(e) => setCount(e.target.checked ? i + 1 : i)}
              label={`${t.label} : ${formatFcfa(t.remaining)}`}
              description={`Échéance le ${t.due}`}
            />
          ))}
          {chosen.map((t) => (
            <input key={t.id} type="hidden" name="installments[]" value={t.id} />
          ))}
        </ChoiceGroup>
      )}

      <FormField label="Numéro Mobile Money (facultatif)" name="phone" info="Il pré-remplit la page de paiement. Vous pourrez aussi payer par carte bancaire.">
        <Input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} leading={<Smartphone className="size-4" />} />
      </FormField>

      <div className="rounded-control bg-surface-2 px-4 py-3">
        <p className="text-sm text-muted">Montant à payer</p>
        <p className="text-2xl font-bold tabular-nums" aria-live="polite">
          {formatFcfa(amount)}
        </p>
      </div>
      <SubmitButton size="lg" disabled={amount <= 0 || leaving} pendingLabel="Préparation du paiement…">
        <Lock aria-hidden /> {leaving ? "Ouverture de la page de paiement…" : `Payer ${formatFcfa(amount)} en ligne`}
      </SubmitButton>
      <p className="text-xs text-muted">
        Vous êtes dirigé vers la page sécurisée de {providerLabel} (MTN MoMo, Moov Money, Celtiis Cash ou carte bancaire). Classéo ne voit jamais votre code secret ni votre carte. Le
        reçu apparaît ici dès que le paiement est confirmé.
      </p>
    </ActionForm>
  );
}
