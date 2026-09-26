"use client";

import { useState } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, ChoiceGroup, Input, Radio, Select } from "@/components/ui/input";
import { plural } from "@/lib/utils";

import { createExam } from "../actions";
import { SchoolPicker, type PickableSchool } from "./school-picker";

type Level = { id: string; code: string; name: string };
type Subject = { code: string; name: string };
type Place = { id: string; name: string };

export function CreateExamForm({
  organizer,
  levels,
  subjects,
  schools,
  communes,
  departments,
  year,
}: {
  // "school": partners are invited; otherwise participation is imposed.
  organizer: { level: "SCHOOL" | "COMMUNE" | "DEPARTMENT" | "NATIONAL"; label: string; home?: { communeId: string; communeName: string; departmentName: string } };
  levels: Level[];
  subjects: Record<string, Subject[]>;
  schools: PickableSchool[];
  communes: Place[];
  departments: Place[];
  year: { label: string; start: string; end: string };
}) {
  const [levelId, setLevelId] = useState<string>("");
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [target, setTarget] = useState<"scope" | "commune" | "department" | "list">("scope");
  const [communeId, setCommuneId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const isSchool = organizer.level === "SCHOOL";
  const offered = levelId ? (subjects[levelId] ?? []) : [];

  // Every subject of the level is ticked when the level changes.
  function pickLevel(id: string) {
    setLevelId(id);
    setChosen(Object.fromEntries((subjects[id] ?? []).map((s) => [s.code, true])));
  }

  const atLevel = schools.filter((s) => !levelId || s.levelIds.includes(levelId));
  const impacted =
    target === "scope"
      ? atLevel.length
      : target === "commune"
        ? atLevel.filter((s) => s.communeId === communeId).length
        : target === "department"
          ? atLevel.filter((s) => s.departmentId === departmentId).length
          : null;

  return (
    <ActionForm action={createExam} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>L&apos;examen</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <FormField label="Intitulé" name="title" required className="sm:col-span-2" hint="Par exemple : Examen blanc du BEPC, premier trimestre.">
            <Input maxLength={120} autoComplete="off" />
          </FormField>
          <FormField label="Classe d'examen" name="levelId" required>
            <Select value={levelId} onChange={(e) => pickLevel(e.target.value)}>
              <option value="" disabled>
                Choisir une classe
              </option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </FormField>
          <p className="self-end text-sm text-muted">Organisateur : {organizer.label}</p>
          <FormField label="Premier jour des épreuves" name="startDate" required hint={`Année scolaire ${year.label}`}>
            <Input type="date" min={year.start} max={year.end} />
          </FormField>
          <FormField label="Dernier jour des épreuves" name="endDate" required hint="Deux semaines au plus.">
            <Input type="date" min={year.start} max={year.end} />
          </FormField>
          <div className="sm:col-span-2">
            <ChoiceGroup legend="Matières" info={levelId ? "Matières du catalogue approuvé enseignées à ce niveau." : "Choisissez d'abord la classe d'examen."} orientation="horizontal">
              {offered.map((s) => (
                <Checkbox
                  key={s.code}
                  name="subjects[]"
                  value={s.code}
                  checked={!!chosen[s.code]}
                  onChange={(e) => setChosen((c) => ({ ...c, [s.code]: e.target.checked }))}
                  label={s.name}
                />
              ))}
            </ChoiceGroup>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isSchool ? "Établissements invités" : "Établissements concernés"}</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          {isSchool ? (
            <>
              <Alert tone="info">
                Chaque établissement invité accepte ou décline. Dès qu&apos;un partenaire a accepté, vous soumettez l&apos;examen à la validation de la hiérarchie : la
                circonscription si tous les établissements sont dans votre commune, la direction départementale sinon.
              </Alert>
              <SchoolPicker schools={schools} levelId={levelId || null} name="partnerIds" legend="Partenaires" home={organizer.home} />
            </>
          ) : (
            <>
              <Alert tone="warning">La participation est imposée : les établissements concernés ne peuvent pas la décliner. L&apos;examen est validé dès sa création.</Alert>
              <ChoiceGroup legend="Qui participe ?">
                <Radio name="target" value="scope" checked={target === "scope"} onChange={() => setTarget("scope")} label="Tous les établissements de mon périmètre" />
                {organizer.level !== "COMMUNE" && communes.length > 0 && (
                  <Radio name="target" value="commune" checked={target === "commune"} onChange={() => setTarget("commune")} label="Tous les établissements d'une commune" />
                )}
                {organizer.level === "NATIONAL" && (
                  <Radio name="target" value="department" checked={target === "department"} onChange={() => setTarget("department")} label="Tous les établissements d'un département" />
                )}
                <Radio name="target" value="list" checked={target === "list"} onChange={() => setTarget("list")} label="Une liste d'établissements" />
              </ChoiceGroup>
              {target === "commune" && (
                <FormField label="Commune" name="communeId" required>
                  <Select value={communeId} onChange={(e) => setCommuneId(e.target.value)}>
                    <option value="" disabled>
                      Choisir une commune
                    </option>
                    {communes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              )}
              {target === "department" && (
                <FormField label="Département" name="departmentId" required>
                  <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                    <option value="" disabled>
                      Choisir un département
                    </option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              )}
              {target === "list" ? (
                <SchoolPicker schools={schools} levelId={levelId || null} name="schoolIds" legend="Établissements" />
              ) : (
                <p className="text-sm text-muted" aria-live="polite">
                  {levelId ? `${plural(impacted ?? 0, "établissement concerné", "établissements concernés")} pour cette classe.` : "Choisissez la classe d'examen pour voir les établissements concernés."}
                </p>
              )}
            </>
          )}
        </CardBody>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <ButtonLink href="/espace/examens-blancs" variant="secondary">
          Annuler
        </ButtonLink>
        <SubmitButton pendingLabel="Création…">{isSchool ? "Créer et envoyer les invitations" : "Décider l'examen blanc"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
