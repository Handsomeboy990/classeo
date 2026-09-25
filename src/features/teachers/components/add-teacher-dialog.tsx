"use client";

import { ArrowLeft, Plus, Search, UserPlus } from "lucide-react";
import { useState } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Input } from "@/components/ui/input";
import { TemporaryPassword, type IssuedPassword } from "@/features/users/components/temporary-password";

import { appointTeacher, createTeacher, searchTeacherRegistry } from "../actions";
import { TeacherFields } from "./teacher-forms";

type Match = {
  id: string;
  firstName: string;
  lastName: string;
  npi: string | null;
  phone: string | null;
  hasAccount: boolean;
  specialty: string | null;
  schools: string[];
  here: "active" | "inactive" | null;
};

// Adding a teacher: the national registry first (NPI, phone or names), then
// an appointment of the person found, or a new registry entry when nobody
// matches. The server checks the registry again before creating anyone.
export function AddTeacherDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"search" | "create">("search");
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [issued, setIssued] = useState<(IssuedPassword & { teacherId: string }) | null>(null);

  function close() {
    setOpen(false);
    setStep("search");
    setMatches(null);
    setIssued(null);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden /> Nouvel enseignant
      </Button>
      <Dialog
        open={open}
        onClose={close}
        size="lg"
        title={issued ? "Enseignant ajouté" : step === "search" ? "Ajouter un enseignant" : "Nouvelle fiche au registre"}
        description={
          issued
            ? undefined
            : step === "search"
              ? "Cherchez d'abord la personne au registre national : si elle enseigne déjà ailleurs, elle sera nommée dans votre établissement sans être enregistrée deux fois."
              : "Personne n'a été trouvé : la fiche est créée au registre national et dans votre établissement."
        }
      >
        {issued ? (
          <div className="flex flex-col gap-4">
            <TemporaryPassword {...issued} onDone={close} />
            <ButtonLink href={`/espace/enseignants/${issued.teacherId}`} variant="secondary" onClick={close}>
              Ouvrir la fiche de l&apos;enseignant
            </ButtonLink>
          </div>
        ) : step === "search" ? (
          <div className="flex flex-col gap-5">
            <ActionForm
              action={searchTeacherRegistry}
              successToast={false}
              onSuccess={(state) => setMatches(((state?.data as { matches?: Match[] } | undefined)?.matches ?? []) as Match[])}
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <FormField label="NPI, téléphone ou nom et prénom" name="q" required hint="Les accents et l'ordre des noms ne comptent pas." className="flex-1">
                <Input autoComplete="off" maxLength={100} placeholder="Par exemple : 2000000123, 0197451230 ou Issifou Nafissatou" />
              </FormField>
              <SubmitButton pendingLabel="Recherche…" className="sm:mb-6">
                <Search aria-hidden /> Chercher
              </SubmitButton>
            </ActionForm>

            {matches && (
              <section aria-label="Résultats du registre" className="flex flex-col gap-3" role="status">
                {matches.length === 0 ? (
                  <Alert tone="info" title="Aucun enseignant trouvé au registre">
                    Vérifiez le numéro ou l&apos;orthographe, ou créez une nouvelle fiche.
                  </Alert>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {matches.map((m) => (
                      <li key={m.id} className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">
                            {m.lastName} {m.firstName}
                          </p>
                          <p className="text-sm text-muted">
                            {[m.npi ? `NPI ${m.npi}` : "Sans NPI", m.phone, m.specialty].filter(Boolean).join(" · ")}
                          </p>
                          <p className="text-sm text-muted">{m.schools.length ? `Enseigne à ${m.schools.join(", ")}` : "Sans établissement actuellement"}</p>
                          {m.hasAccount && (
                            <Badge tone="info" className="mt-1">
                              A déjà un compte de connexion
                            </Badge>
                          )}
                        </div>
                        {m.here ? (
                          <Badge tone={m.here === "active" ? "success" : "neutral"}>{m.here === "active" ? "Déjà dans votre équipe" : "Inactif chez vous"}</Badge>
                        ) : (
                          <ActionForm action={appointTeacher} successToast={false}>
                            <input type="hidden" name="profileId" value={m.id} />
                            <SubmitButton size="sm" pendingLabel="Nomination…">
                              <UserPlus aria-hidden /> Nommer dans mon établissement
                            </SubmitButton>
                          </ActionForm>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="ds-dialog-actions">
                  <Button type="button" variant="secondary" onClick={close}>
                    Annuler
                  </Button>
                  <Button type="button" onClick={() => setStep("create")}>
                    <Plus aria-hidden /> {matches.length ? "Aucun de ces enseignants : nouvelle fiche" : "Créer une nouvelle fiche"}
                  </Button>
                </div>
              </section>
            )}
          </div>
        ) : (
          <ActionForm
            action={createTeacher}
            successToast={false}
            onSuccess={(state) => {
              const data = state?.data as (IssuedPassword & { teacherId: string }) | undefined;
              if (data) setIssued(data);
            }}
            onReset={(e) => e.preventDefault()}
            className="flex flex-col gap-4"
          >
            <TeacherFields />
            <FormField label="Adresse e-mail" name="email" hint="Facultatif.">
              <Input type="email" autoComplete="off" maxLength={200} />
            </FormField>
            <Checkbox
              name="createAccount"
              defaultChecked
              label="Créer aussi son compte de connexion"
              description="Un identifiant prénom.nom et un mot de passe temporaire, affichés une seule fois, pour saisir notes et présences."
            />
            <Checkbox name="confirmNew" label="Il s'agit d'une autre personne" description="À cocher seulement si un homonyme existe déjà au registre." />
            <div className="ds-dialog-actions">
              <Button type="button" variant="secondary" onClick={() => setStep("search")}>
                <ArrowLeft aria-hidden /> Retour à la recherche
              </Button>
              <SubmitButton pendingLabel="Ajout…">Ajouter l&apos;enseignant</SubmitButton>
            </div>
          </ActionForm>
        )}
      </Dialog>
    </>
  );
}
