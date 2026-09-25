"use client";

import { ReceiptText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { announceSuccess } from "@/features/fees/components/toast-action";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentMethodCode } from "@/lib/domain/payments";
import { formatFcfa } from "@/lib/utils";

import { recordPayment } from "../actions";

const submitPayment = announceSuccess(recordPayment);

const TRANSACTION_LABEL: Record<PaymentMethodCode, string> = {
  CASH: "Référence (facultatif)",
  MOBILE_MONEY: "Référence de la transaction Mobile Money",
  BANK_TRANSFER: "Référence du virement",
  CHEQUE: "Numéro du chèque",
};

// Records a payment on an invoice. The waterfall over the installments is
// applied on the server; the amount is capped at the remaining due there too.
export function PaymentForm({ invoiceId, remaining, today }: { invoiceId: string; remaining: number; today: string }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethodCode>("CASH");
  // Controlled fields: React resets uncontrolled ones after every action,
  // which would erase the input when the server refuses it.
  const [transactionId, setTransactionId] = useState("");
  const [paidAt, setPaidAt] = useState(today);
  const [last, setLast] = useState<{ paymentId: string; reference: string } | null>(null);

  return (
    <ActionForm
      action={submitPayment}
      onSuccess={(state) => {
        setAmount("");
        setMethod("CASH");
        setTransactionId("");
        setPaidAt(today);
        setLast((state?.data as { paymentId: string; reference: string } | undefined) ?? null);
      }}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <FormField label="Montant versé" name="amount" required hint={`Reste à payer : ${formatFcfa(remaining)}`}>
        <Input type="number" inputMode="numeric" min={1} max={remaining} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} trailing="FCFA" />
      </FormField>
      <Button type="button" variant="ghost" size="sm" className="-mt-2 self-start" onClick={() => setAmount(String(remaining))}>
        Solder la facture ({formatFcfa(remaining)})
      </Button>
      <FormField label="Mode de paiement" name="method" required>
        <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethodCode)}>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label={TRANSACTION_LABEL[method]} name="transactionId" required={method !== "CASH"}>
        <Input autoComplete="off" maxLength={80} value={transactionId} onChange={(e) => setTransactionId(e.target.value)} />
      </FormField>
      <FormField label="Date du paiement" name="paidAt" required>
        <Input type="date" max={today} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
      </FormField>
      <SubmitButton pendingLabel="Enregistrement du paiement…">Enregistrer le paiement</SubmitButton>
      {last && (
        <p role="status" className="rounded-lg bg-success-soft px-3 py-2 text-sm text-text">
          Paiement {last.reference} enregistré.{" "}
          <Link href={`/espace/frais/paiements/${last.paymentId}/recu`} className="inline-flex items-center gap-1 font-semibold text-primary underline">
            <ReceiptText className="size-4" aria-hidden /> Imprimer le reçu
          </Link>
        </p>
      )}
    </ActionForm>
  );
}
