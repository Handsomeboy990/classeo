"use client";

import { Smartphone } from "lucide-react";
import { useState } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { FileInput, Input, Select } from "@/components/ui/input";
import { formatFcfa } from "@/lib/utils";

import { declarePayment } from "../actions";

export type SchoolAccount = { id: string; channel: "MOBILE_MONEY" | "BANK"; provider: string; accountName: string; accountNumber: string };

// Declares a payment already made to one of the school's accounts. Every
// field is controlled, so a refused declaration keeps what was typed.
export function DeclarationForm({ invoiceId, max, accounts, suggestions, defaultPhone }: { invoiceId: string; max: number; accounts: SchoolAccount[]; suggestions: { label: string; amount: number }[]; defaultPhone: string }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const account = accounts.find((a) => a.id === accountId);
  const method = account?.channel === "BANK" ? "BANK_TRANSFER" : "MOBILE_MONEY";
  const [amount, setAmount] = useState("");
  const [payerPhone, setPayerPhone] = useState(defaultPhone);
  const [transactionRef, setTransactionRef] = useState("");
  const [formKey, setFormKey] = useState(0);

  return (
    <ActionForm
      key={formKey}
      action={declarePayment}
      onSuccess={() => {
        setAmount("");
        setTransactionRef("");
        setFormKey((k) => k + 1);
      }}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="method" value={method} />
      <FormField label="Compte de l'école utilisé" name="accountId" required>
        <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.provider} · {a.accountNumber}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Montant payé" name="amount" required hint={`Au plus ${formatFcfa(max)}.`}>
        <Input type="number" inputMode="numeric" min={1} max={max} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} trailing="FCFA" />
      </FormField>
      {suggestions.length > 0 && (
        <div className="-mt-2 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s.label} type="button" onClick={() => setAmount(String(s.amount))} className="rounded-full border border-border px-3 py-1.5 text-sm font-semibold hover:bg-surface-2">
              {s.label} ({formatFcfa(s.amount)})
            </button>
          ))}
        </div>
      )}
      {method === "MOBILE_MONEY" && (
        <FormField label="Numéro qui a payé" name="payerPhone" required>
          <Input type="tel" inputMode="tel" autoComplete="tel" value={payerPhone} onChange={(e) => setPayerPhone(e.target.value)} leading={<Smartphone className="size-4" />} />
        </FormField>
      )}
      <FormField
        label={method === "MOBILE_MONEY" ? "Référence de la transaction (SMS de confirmation)" : "Référence du virement"}
        name="transactionRef"
        required
        hint="Recopiez-la telle qu'elle figure sur le SMS ou le reçu. Une référence ne se déclare qu'une fois."
      >
        <Input autoComplete="off" maxLength={60} value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} />
      </FormField>
      <FormField label="Preuve (facultatif)" name="proof" hint="Capture du SMS ou reçu de la banque : image ou PDF, 2 Mo au maximum.">
        <FileInput accept="image/jpeg,image/png,image/webp,application/pdf" />
      </FormField>
      <SubmitButton pendingLabel="Envoi de la déclaration…">Déclarer ce paiement</SubmitButton>
    </ActionForm>
  );
}
