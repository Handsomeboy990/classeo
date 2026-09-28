"use client";

import { useState } from "react";

import { ActionForm, SubmitButton, useFormState } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { ImageUpload } from "@/components/kit/image-upload";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, ChoiceGroup, Input, Radio, Select } from "@/components/ui/input";

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
  // null: the editor may not read the student's special needs (decision
  // D8), so the field is left out and the saved value is kept.
  disabilities: string[] | null;
  classroomId: string;
  isRepeating: boolean;
  photoUrl?: string | null;
};

function Disabilities({ values }: { values?: string[] }) {
  const state = useFormState();
  const error = state?.fieldErrors?.disabilities?.[0];
  return (
    <div className="sm:col-span-2">
      <ChoiceGroup legend="Besoins particuliers" info="Pour adapter l'accueil, les supports et les évaluations.">
        <div className="grid gap-x-6 sm:grid-cols-2">
          {DISABILITIES.map((d) => (
            <Checkbox key={d} name="disabilities[]" value={d} defaultChecked={values?.includes(d)} label={DISABILITY_LABELS[d]} aria-invalid={error ? true : undefined} />
          ))}
        </div>
      </ChoiceGroup>
      {error && <p className="mt-1 text-sm font-semibold text-danger">{error}</p>}
    </div>
  );
}

// Enrollment form (create) and profile form (edit). On failure the input is
// kept and the focus goes to the first rejected field.
export function StudentForm({ classes, guardians, values, cancelHref }: { classes: ClassOption[]; guardians?: GuardianOption[]; values?: StudentValues; cancelHref: string }) {
  const [mode, setMode] = useState<"existing" | "new">("new");
  const editing = !!values;
  return (
    <ActionForm action={editing ? updateStudent : createStudent} onReset={(e) => e.preventDefault()} className="flex max-w-3xl flex-col gap-6">
      {values && <input type="hidden" name="id" value={values.id} />}
      <Card>
        <CardHeader>
          <CardTitle>Élève</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <ImageUpload
              name="photo"
              label="Photo de l'élève (facultative)"
              currentUrl={values?.photoUrl}
              shape="circle"
              maxSide={480}
              hint="Elle apparaît sur la fiche, le bulletin et l'attestation. Sans photo, les initiales sont affichées."
            />
          </div>
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
          <FormField label="Classe" name="classroomId" required info={editing ? "Un changement de classe n'est possible qu'avant la première note." : undefined}>
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
          <Checkbox name="isRepeating" defaultChecked={values?.isRepeating} label="Redoublant cette année" labelClassName="sm:col-span-2" />
          {values?.disabilities !== null && <Disabilities values={values?.disabilities} />}
        </CardBody>
      </Card>

      {!editing && (
        <Card>
          <CardHeader>
            <CardTitle>Parent ou tuteur principal</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <ChoiceGroup legend="Le parent est-il déjà connu de l'établissement ?" orientation="horizontal" className="sm:col-span-2">
              <Radio name="guardianMode" value="new" checked={mode === "new"} onChange={() => setMode("new")} label="Nouveau parent" />
              <Radio
                name="guardianMode"
                value="existing"
                checked={mode === "existing"}
                onChange={() => setMode("existing")}
                disabled={!guardians?.length}
                label="Parent déjà inscrit"
                description="Un frère ou une sœur est dans l'établissement."
              />
            </ChoiceGroup>
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
                <FormField label="Canal de contact préféré" name="guardianChannel" info="L'appel vocal convient aux parents qui lisent peu.">
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

      <div className="flex justify-end gap-2 max-sm:*:flex-1">
        <ButtonLink href={cancelHref} variant="secondary">
          Annuler
        </ButtonLink>
        <SubmitButton>{editing ? "Enregistrer" : "Inscrire l'élève"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
