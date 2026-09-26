"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select, Switch } from "@/components/ui/input";
import { DENOMINATION_LABELS, DENOMINATIONS } from "@/lib/domain/school-types";

import { PERIODICITY_LABELS } from "@/lib/domain/periodicity";

import { createSchool, updateSchool } from "../actions";
import { CYCLE_LABELS, CYCLES, SECTOR_LABELS, SECTORS } from "../labels";

type CommuneOption = { id: string; name: string; department: { id: string; name: string } };

export type SchoolFormValues = {
  id: string;
  name: string;
  sector: string;
  cycle: string;
  communeId: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  periodicity: string;
  denomination: string | null;
  isBilingual: boolean;
  authorizationRef: string | null;
  authorizationDate: string | null;
  promoter: string | null;
};

// Create or edit a school. The communes offered are those of the user's
// scope; the server checks the commune again.
// canSetPeriodicity: the ministry, which alone may depart from the national
// rule (semesters in public secondary schools, trimesters elsewhere).
export function SchoolFormDialog({ communes, school, canSetPeriodicity = false }: { communes: CommuneOption[]; school?: SchoolFormValues; canSetPeriodicity?: boolean }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const editing = !!school;
  const groups = new Map<string, { name: string; items: CommuneOption[] }>();
  for (const c of communes) {
    const g = groups.get(c.department.id) ?? { name: c.department.name, items: [] };
    g.items.push(c);
    groups.set(c.department.id, g);
  }

  return (
    <>
      <Button variant={editing ? "secondary" : "primary"} onClick={() => setOpen(true)}>
        {editing ? <Pencil aria-hidden /> : <Plus aria-hidden />}
        {editing ? "Modifier" : "Nouvel établissement"}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={editing ? `Modifier ${school.name}` : "Nouvel établissement"} description="Les champs marqués d'un astérisque sont obligatoires.">
        <ActionForm
          action={editing ? updateSchool : createSchool}
          onSuccess={(state) => {
            setOpen(false);
            const id = (state?.data as { id?: string } | undefined)?.id;
            if (!editing && id) router.push(`/espace/etablissements/${id}`);
          }}
          className="flex flex-col gap-4"
        >
          {editing && <input type="hidden" name="id" value={school.id} />}
          <FormField label="Nom de l'établissement" name="name" required>
            <Input defaultValue={school?.name} maxLength={150} autoComplete="off" />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Secteur" name="sector" required>
              <Select defaultValue={school?.sector ?? "PUBLIC"}>
                {SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {SECTOR_LABELS[s]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Cycle" name="cycle" required>
              <Select defaultValue={school?.cycle ?? "PRIMARY"}>
                {CYCLES.map((c) => (
                  <option key={c} value={c}>
                    {CYCLE_LABELS[c]}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <fieldset className="flex flex-col gap-4 rounded-control border border-border p-3">
            <legend className="px-1 text-sm font-semibold">Établissement non public</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Confession" name="denomination" hint="Pour un établissement privé confessionnel.">
                <Select defaultValue={school?.denomination ?? ""}>
                  <option value="">Aucune</option>
                  {DENOMINATIONS.map((d) => (
                    <option key={d} value={d}>
                      {DENOMINATION_LABELS[d]}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Promoteur" name="promoter" hint="Personne ou organisme qui crée et finance l'établissement.">
                <Input defaultValue={school?.promoter ?? ""} maxLength={150} />
              </FormField>
              <FormField label="Arrêté d'autorisation" name="authorizationRef" hint="Référence de l'arrêté d'ouverture.">
                <Input defaultValue={school?.authorizationRef ?? ""} maxLength={120} />
              </FormField>
              <FormField label="Date de l'arrêté" name="authorizationDate">
                <Input type="date" defaultValue={school?.authorizationDate ?? ""} />
              </FormField>
            </div>
            <Switch name="isBilingual" defaultChecked={school?.isBilingual ?? false} label="Programme bilingue" description="Enseignement en français et dans une autre langue, sous régime spécial." />
          </fieldset>
          {canSetPeriodicity && (
            <FormField label="Périodicité d'évaluation" name="periodicity" hint="Par défaut : semestres pour le secondaire public, trimestres ailleurs. Les congés restent ceux du calendrier national.">
              <Select defaultValue={school?.periodicity ?? ""}>
                <option value="">Règle nationale selon le secteur et le cycle</option>
                <option value="TRIMESTER">{PERIODICITY_LABELS.TRIMESTER}</option>
                <option value="SEMESTER">{PERIODICITY_LABELS.SEMESTER}</option>
              </Select>
            </FormField>
          )}
          <FormField label="Commune" name="communeId" required hint={communes.length === 1 ? "Votre périmètre compte une seule commune." : undefined}>
            <Select defaultValue={school?.communeId ?? (communes.length === 1 ? communes[0]!.id : "")}>
              {communes.length > 1 && <option value="">Choisir une commune</option>}
              {[...groups.values()].map((g) =>
                groups.size > 1 ? (
                  <optgroup key={g.name} label={g.name}>
                    {g.items.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                ) : (
                  g.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))
                ),
              )}
            </Select>
          </FormField>
          <FormField label="Adresse" name="address">
            <Input defaultValue={school?.address ?? ""} maxLength={200} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Téléphone" name="phone" hint="Exemple : 01 97 12 34 56">
              <Input type="tel" defaultValue={school?.phone ?? ""} inputMode="tel" />
            </FormField>
            <FormField label="Adresse e-mail" name="email">
              <Input type="email" defaultValue={school?.email ?? ""} />
            </FormField>
          </div>
          <div className="ds-dialog-actions">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <SubmitButton>{editing ? "Enregistrer" : "Créer l'établissement"}</SubmitButton>
          </div>
        </ActionForm>
      </Dialog>
    </>
  );
}
