"use client";

import { FilePlus2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { Input } from "@/components/ui/input";
import { formatFcfa, formatNumber } from "@/lib/utils";

import { generateInvoices } from "../actions";

import { FocusFirstError } from "./focus-first-error";
import { announceSuccess } from "./toast-action";

// Confirmation step of the invoice generation. The server recomputes who
// must be billed at submit time, so a preview that became stale cannot
// produce duplicates.
export function GenerateForm({ feeTypeId, toCreate, total, needsDueDate, today }: { feeTypeId: string; toCreate: number; total: number; needsDueDate: boolean; today: string }) {
  const router = useRouter();
  const [dueDate, setDueDate] = useState("");
  // The preview re-renders with nothing left to create and unmounts this
  // form, so the redirect happens from the action result itself.
  const action = useMemo(() => announceSuccess(generateInvoices, () => router.push("/espace/frais/factures")), [router]);
  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <FocusFirstError />
      <input type="hidden" name="feeTypeId" value={feeTypeId} />
      {needsDueDate && (
        <FormField label="Date limite de paiement" name="dueDate" required hint="Ce type de frais n'a pas d'échéancier : il sera payable en une fois.">
          <Input type="date" min={today} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </FormField>
      )}
      <SubmitButton pendingLabel="Création des factures…" disabled={toCreate === 0}>
        <FilePlus2 aria-hidden /> Créer {formatNumber(toCreate)} facture(s) pour {formatFcfa(total)}
      </SubmitButton>
    </ActionForm>
  );
}
