"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";

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
};

// Create or edit a school. The communes offered are those of the user's
// scope; the server checks the commune again.
export function SchoolFormDialog({ communes, school }: { communes: CommuneOption[]; school?: SchoolFormValues }) {
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
          <div className="flex justify-end gap-2 pt-2">
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
