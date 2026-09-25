"use client";

import { useState } from "react";

import { FormField } from "@/components/kit/form-field";
import { ChoiceGroup, Input, Radio, Select, Switch, Textarea } from "@/components/ui/input";

import { MOBILE_MONEY_PROVIDERS } from "../rules";

export type AccountValues = {
  id?: string;
  channel: "MOBILE_MONEY" | "BANK";
  provider: string;
  accountName: string;
  accountNumber: string;
  instructions: string | null;
  isActive: boolean;
};

// Mobile Money networks are a fixed list; a bank is typed. The number field
// adapts its keyboard and its hint to the channel.
export function AccountFields({ values }: { values?: AccountValues }) {
  const [channel, setChannel] = useState<AccountValues["channel"]>(values?.channel ?? "MOBILE_MONEY");
  const mm = channel === "MOBILE_MONEY";
  return (
    <>
      {values?.id && <input type="hidden" name="id" value={values.id} />}
      <ChoiceGroup legend="Moyen de paiement" orientation="horizontal">
        <Radio name="channel" value="MOBILE_MONEY" checked={mm} onChange={() => setChannel("MOBILE_MONEY")} label="Mobile Money" />
        <Radio name="channel" value="BANK" checked={!mm} onChange={() => setChannel("BANK")} label="Compte bancaire" />
      </ChoiceGroup>
      {mm ? (
        <FormField key="mm" label="Réseau" name="provider" required>
          <Select defaultValue={values?.channel === "MOBILE_MONEY" ? values.provider : MOBILE_MONEY_PROVIDERS[0]}>
            {MOBILE_MONEY_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </FormField>
      ) : (
        <FormField key="bank" label="Banque" name="provider" required hint="Par exemple : Ecobank Bénin, BOA Bénin, Orabank.">
          <Input defaultValue={values?.channel === "BANK" ? values.provider : ""} maxLength={80} />
        </FormField>
      )}
      <FormField label="Titulaire du compte" name="accountName" required hint="Le nom que le parent verra lors du paiement.">
        <Input defaultValue={values?.accountName ?? ""} maxLength={120} />
      </FormField>
      <FormField key={`number-${channel}`} label={mm ? "Numéro Mobile Money" : "IBAN ou RIB"} name="accountNumber" required hint={mm ? "10 chiffres, par exemple 01 97 12 34 56." : "BJ suivi de 26 caractères, ou le RIB complet."}>
        <Input defaultValue={values?.channel === channel ? values.accountNumber : ""} inputMode={mm ? "tel" : "text"} maxLength={60} autoComplete="off" />
      </FormField>
      <FormField label="Consignes pour les parents" name="instructions" hint="Facultatif. Par exemple : indiquez le matricule de l'élève en motif.">
        <Textarea rows={2} maxLength={300} defaultValue={values?.instructions ?? ""} />
      </FormField>
      <Switch name="isActive" defaultChecked={values?.isActive ?? true} label="Proposer ce compte aux parents" description="Un compte inactif reste enregistré mais n'est plus affiché." />
    </>
  );
}
