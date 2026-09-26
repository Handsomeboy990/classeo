import { FormField } from "@/components/kit/form-field";
import { Input, Select, Switch } from "@/components/ui/input";

import { FEE_KIND_LABELS, type FeeKind } from "@/lib/domain/free-schooling";

type Initial = { id: string; name: string; kind: FeeKind; amount: number; levelId: string | null; isActive: boolean };

// Fields of the fee type form, placed in a kit FormDialog that holds the
// action and the buttons. The dialog keeps what was typed when the server
// refuses it.
export function FeeTypeFields({ levels, initial }: { levels: { id: string; name: string }[]; initial?: Initial }) {
  return (
    <>
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <FormField label="Nom" name="name" required hint="Par exemple : contribution scolaire, cotisation APE, tenue.">
        <Input defaultValue={initial?.name} maxLength={120} autoComplete="off" />
      </FormField>
      <FormField label="Nature" name="kind" required hint="Au secondaire public, les filles sont exonérées de la contribution scolaire depuis 2026-2027 : elles ne reçoivent pas de facture.">
        <Select defaultValue={initial?.kind ?? "OTHER"}>
          {(Object.keys(FEE_KIND_LABELS) as FeeKind[]).map((k) => (
            <option key={k} value={k}>
              {FEE_KIND_LABELS[k]}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Montant par élève" name="amount" required>
        <Input type="number" inputMode="numeric" min={1} step={1} defaultValue={initial?.amount} trailing="FCFA" />
      </FormField>
      <FormField label="Niveau concerné" name="levelId" hint="« Tous les niveaux » facture chaque élève de l'établissement.">
        <Select defaultValue={initial?.levelId ?? ""}>
          <option value="">Tous les niveaux</option>
          {levels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      </FormField>
      {initial && <Switch name="isActive" defaultChecked={initial.isActive} label="Actif" description="Un type de frais désactivé ne peut plus être facturé." />}
    </>
  );
}
