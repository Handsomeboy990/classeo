"use client";

import { useState } from "react";

import { ActionForm, SubmitButton, useFormState } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { FocusFirstInvalid } from "@/features/classes/components/focus-invalid";

import { createStudent, updateStudent } from "../actions";
import { CHANNEL_LABELS, DISABILITIES, DISABILITY_LABELS, RELATIONSHIPS } from "../labels";

type ClassOption = { id: string; name: string; capacity: number; _count: { enrollments: number } };
type GuardianOption = { id: string; firstName: string; lastName: string; phone: string };

export type StudentValues = {
  id: string;
  lastName: string;
  firstName: string;
  gender: "F" | "M";
  birthDate: string;
  birthPlace: string | null;
  disabilities: string[];
  classroomId: string;
  isRepeating: boolean;
};

function Disabilities({ values }: { values?: string[] }) {
  const state = useFormState();
  const error = state?.fieldErrors?.disabilities?.[0];
  return (
    <fieldset className="sm:col-span-2">
      <legend className="text-sm font-semibold">Besoins particuliers</legend>
      <p className="text-xs text-muted">Permet d&apos;adapter l&apos;accueil, les supports et les évaluations.</p>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
        {DISABILITIES.map((d) => (
          <label key={d} className="inline-flex min-h-10 items-center gap-2 text-sm">
            <input type="checkbox" name="disabilities[]" value={d} defaultChecked={values?.includes(d)} className="size-5 accent-primary" />
            {DISABILITY_LABELS[d]}
          </label>
        ))}
      </div>
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
    </fieldset>
  );
}

// Enrollment form (create) and profile form (edit). On failure the input is
// kept and the focus goes to the first rejected field.
export function StudentForm({ classes, guardians, values, cancelHref }: { classes: ClassOption[]; guardians?: GuardianOption[]; values?: StudentValues; cancelHref: string }) {
  const [mode, setMode] = useState<"existing" | "new">("new");
  const editing = !!values;
  return (
    <ActionForm action={editing ? updateStudent : createStudent} onReset={(e) => e.preventDefault()} className="flex max-w-3xl flex-col gap-6">
      <FocusFirstInvalid />
      {values && <input type="hidden" name="id" value={values.id} />}
      <Card>
        <CardHeader>
          <CardTitle>Élève</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <FormField label="Nom" name="lastName" required>
            <Input defaultValue={values?.lastName} autoComplete="off" maxLength={60} />
          </FormField>
          <FormField label="Prénoms" name="firstName" required>
            <Input defaultValue={values?.firstName} autoComplete="off" maxLength={60} />
          </FormField>
          <FormField label="Sexe" name="gender" required>
            <Select defaultValue={values?.gender ?? ""}>
              <option value="" disabled>
                Choisir
              </option>
              <option value="F">Fille</option>
              <option value="M">Garçon</option>
            </Select>
          </FormField>
          <FormField label="Date de naissance" name="birthDate" required>
            <Input type="date" defaultValue={values?.birthDate} />
          </FormField>
          <FormField label="Lieu de naissance" name="birthPlace">
            <Input defaultValue={values?.birthPlace ?? ""} maxLength={80} />
          </FormField>
          <FormField label="Classe" name="classroomId" required hint={editing ? "Un changement de classe n'est possible qu'avant la première note." : undefined}>
            <Select defaultValue={values?.classroomId ?? ""}>
              <option value="" disabled>
                Choisir une classe
              </option>
              {classes.map((c) => {
                const full = c._count.enrollments >= c.capacity && c.id !== values?.classroomId;
                return (
                  <option key={c.id} value={c.id} disabled={full}>
                    {c.name} ({c._count.enrollments}/{c.capacity}
                    {full ? ", complète" : ""})
                  </option>
                );
              })}
            </Select>
          </FormField>
          <label className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold sm:col-span-2">
            <input type="checkbox" name="isRepeating" defaultChecked={values?.isRepeating} className="size-5 accent-primary" />
            Redoublant cette année
          </label>
          <Disabilities values={values?.disabilities} />
        </CardBody>
      </Card>

      {!editing && (
        <Card>
          <CardHeader>
            <CardTitle>Parent ou tuteur principal</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-semibold">Le parent est-il déjà connu de l&apos;établissement ?</legend>
              <div className="mt-2 flex flex-wrap gap-5">
                <label className="inline-flex min-h-10 items-center gap-2 text-sm">
                  <input type="radio" name="guardianMode" value="new" checked={mode === "new"} onChange={() => setMode("new")} className="size-5 accent-primary" />
                  Nouveau parent
                </label>
                <label className="inline-flex min-h-10 items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="guardianMode"
                    value="existing"
                    checked={mode === "existing"}
                    onChange={() => setMode("existing")}
                    className="size-5 accent-primary"
                    disabled={!guardians?.length}
                  />
                  Parent déjà inscrit (frère ou sœur dans l&apos;établissement)
                </label>
              </div>
            </fieldset>
            {mode === "existing" ? (
              <FormField label="Parent" name="guardianId" required className="sm:col-span-2">
                <Select defaultValue="">
                  <option value="" disabled>
                    Choisir un parent
                  </option>
                  {guardians?.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.lastName} {g.firstName} · {g.phone}
                    </option>
                  ))}
                </Select>
              </FormField>
            ) : (
              <>
                <FormField label="Nom du parent" name="guardianLastName" required>
                  <Input autoComplete="off" maxLength={60} />
                </FormField>
                <FormField label="Prénoms du parent" name="guardianFirstName" required>
                  <Input autoComplete="off" maxLength={60} />
                </FormField>
                <FormField label="Téléphone" name="guardianPhone" required hint="Par exemple : 01 97 12 34 56">
                  <Input type="tel" inputMode="tel" autoComplete="off" />
                </FormField>
                <FormField label="Profession" name="guardianProfession">
                  <Input maxLength={80} />
                </FormField>
                <FormField label="Canal de contact préféré" name="guardianChannel" hint="L'appel vocal convient aux parents qui lisent peu.">
                  <Select defaultValue="APP">
                    {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </>
            )}
            <FormField label="Lien avec l'élève" name="relationship" required>
              <Select defaultValue="Mère">
                {RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </FormField>
          </CardBody>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <ButtonLink href={cancelHref} variant="secondary">
          Annuler
        </ButtonLink>
        <SubmitButton>{editing ? "Enregistrer" : "Inscrire l'élève"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
