"use client";

import { useState } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { Input, Select } from "@/components/ui/input";

import { createFeeType, updateFeeType } from "../actions";

import { FocusFirstError } from "./focus-first-error";
import { useCloseDialog } from "./form-dialog";

type Initial = { id: string; name: string; amount: number; levelId: string | null; isActive: boolean };

export function FeeTypeForm({ levels, initial }: { levels: { id: string; name: string }[]; initial?: Initial }) {
  const close = useCloseDialog();
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [levelId, setLevelId] = useState(initial?.levelId ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  return (
    <ActionForm action={initial ? updateFeeType : createFeeType} onSuccess={close} className="flex flex-col gap-4">
      <FocusFirstError />
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <FormField label="Nom" name="name" required hint="Par exemple : Contribution scolaire, Cotisation APE, Tenue.">
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="off" />
      </FormField>
      <FormField label="Montant par élève (FCFA)" name="amount" required>
        <Input type="number" inputMode="numeric" min={1} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
      </FormField>
      <FormField label="Niveau concerné" name="levelId" hint="Laissez « Tous les niveaux » pour facturer tous les élèves de l'établissement.">
        <Select value={levelId} onChange={(e) => setLevelId(e.target.value)}>
          <option value="">Tous les niveaux</option>
          {levels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      </FormField>
      {initial && (
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="isActive" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="size-5 accent-primary" />
          Actif (peut être facturé)
        </label>
      )}
      <SubmitButton className="self-end">{initial ? "Enregistrer" : "Créer le type de frais"}</SubmitButton>
    </ActionForm>
  );
}
