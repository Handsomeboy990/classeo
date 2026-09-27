import { ArrowLeftRight, School, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { PageHeader } from "@/components/kit/page-header";
import { EmptyState } from "@/components/kit/states";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, ChoiceGroup, Input, Label, Radio, Select, Textarea } from "@/components/ui/input";
import { StudentAvatar } from "@/features/students/components/student-avatar";
import { changeClass, requestSchoolChange } from "@/features/transfers/actions";
import { FieldError } from "@/features/transfers/components/field-error";
import { TransfersOff } from "@/features/transfers/components/module-off";
import { searchSchools, transferContext } from "@/features/transfers/queries";
import { requirePermission } from "@/lib/auth/authorize";
import { isEnabled } from "@/lib/features";
import { param } from "@/lib/list";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Transférer un élève" };

const CYCLES = { PRESCHOOL: "Maternelle", PRIMARY: "Primaire", SECONDARY: "Secondaire", TECHNICAL: "Technique" } as const;

// Two kinds of transfer from one page: the kind and the school search live
// in the URL, so the page works without JavaScript and survives a reload.
export default async function NewTransferPage(props: PageProps<"/espace/transferts/nouveau">) {
  const user = await requirePermission("student:update");
  const sp = await props.searchParams;
  const studentId = param(sp, "eleve") ?? "";
  if (!(await isEnabled("students.transfers"))) {
    return (
      <>
        <PageHeader title="Transférer un élève" readable={false} />
        <TransfersOff />
      </>
    );
  }
  const ctx = await transferContext(user, studentId);
  if (!ctx) notFound();
  const { enrollment: e, classes, pending } = ctx;
  const s = e.student;
  const name = `${s.firstName} ${s.lastName}`;
  const kind = param(sp, "type") === "etablissement" ? "school" : "class";
  const q = (param(sp, "ecole") ?? "").trim().slice(0, 80);
  const schools = kind === "school" ? await searchSchools({ q, excludeId: e.schoolId }) : [];
  const guardian = s.guardians[0]?.guardian ?? null;
  const base = `/espace/transferts/nouveau?eleve=${s.id}`;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Élèves", href: "/espace/eleves" }, { label: name, href: `/espace/eleves/${s.id}` }, { label: "Transférer" }]} title={`Transférer ${name}`} description={`Actuellement en ${e.classroom.name}, ${e.school.name}.`} readable={false} />

      <div className="mb-6 flex items-center gap-3">
        <StudentAvatar name={name} photoFileId={s.photoFileId} className="size-12 text-base" />
        <p className="text-sm text-muted">
          Matricule <span className="font-mono">{s.matricule}</span>
        </p>
      </div>

      {pending ? (
        <Alert
          tone="warning"
          title="Un transfert est déjà en cours"
          action={
            <ButtonLink href={`/espace/transferts/${pending.id}`} variant="secondary" size="sm">
              Voir le transfert
            </ButtonLink>
          }
        >
          Vers {pending.toSchool.name}. Attendez sa conclusion ou annulez-le avant d&apos;en demander un autre.
        </Alert>
      ) : (
        <div className="flex max-w-3xl flex-col gap-6">
          <nav aria-label="Type de transfert" className="grid gap-3 sm:grid-cols-2">
            {[
              { key: "class", href: `${base}&type=classe`, icon: ArrowLeftRight, title: "Changer de classe", text: "Dans votre établissement. Immédiat." },
              { key: "school", href: `${base}&type=etablissement`, icon: School, title: "Changer d'établissement", text: "Accord du parent puis de l'école d'accueil." },
            ].map((o) => (
              <Link
                key={o.key}
                href={o.href}
                aria-current={kind === o.key ? "page" : undefined}
                className={cn(
                  "flex items-start gap-3 rounded-card border p-4 shadow-card transition-[border-color,box-shadow] duration-150",
                  kind === o.key ? "border-primary bg-primary-soft shadow-[inset_3px_0_0_var(--primary)]" : "border-border bg-surface hover:border-primary/40 hover:shadow-[var(--elevation-sm)]",
                )}
              >
                <o.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="block font-semibold">{o.title}</span>
                  <span className="block text-sm text-muted">{o.text}</span>
                </span>
              </Link>
            ))}
          </nav>

          {kind === "class" ? (
            <Card>
              <CardHeader>
                <CardTitle>Nouvelle classe</CardTitle>
              </CardHeader>
              <CardBody>
                {classes.length ? (
                  <ActionForm action={changeClass} onReset={(ev) => ev.preventDefault()} className="flex flex-col gap-4">
                    <input type="hidden" name="studentId" value={s.id} />
                    <FormField label="Classe de destination" name="toClassroomId" required info="Même niveau ou autre niveau. Les notes déjà saisies restent dans le parcours.">
                      <Select defaultValue="">
                        <option value="" disabled>
                          Choisir une classe
                        </option>
                        {classes.map((c) => {
                          const full = c._count.enrollments >= c.capacity;
                          return (
                            <option key={c.id} value={c.id} disabled={full}>
                              {c.name} ({c._count.enrollments}/{c.capacity}
                              {full ? ", complète" : ""})
                            </option>
                          );
                        })}
                      </Select>
                    </FormField>
                    <FormField label="Motif" name="reason" required>
                      <Textarea rows={3} maxLength={300} placeholder="Par exemple : changement de série, rapprochement d'un frère" />
                    </FormField>
                    <div className="flex justify-end gap-2 max-sm:*:flex-1">
                      <ButtonLink href={`/espace/eleves/${s.id}`} variant="secondary">
                        Annuler
                      </ButtonLink>
                      <SubmitButton>Changer de classe</SubmitButton>
                    </div>
                  </ActionForm>
                ) : (
                  <EmptyState title="Aucune autre classe cette année" description="Créez d'abord la classe de destination." />
                )}
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Établissement d&apos;accueil</CardTitle>
              </CardHeader>
              <CardBody className="flex flex-col gap-5">
                <form method="get" action="/espace/transferts/nouveau" role="search" className="flex flex-col gap-1.5">
                  <input type="hidden" name="eleve" value={s.id} />
                  <input type="hidden" name="type" value="etablissement" />
                  <Label htmlFor="school-search">Rechercher un établissement</Label>
                  <div className="flex gap-2">
                    <Input id="school-search" name="ecole" type="search" defaultValue={q} placeholder="Nom, commune ou département" autoComplete="off" leading={<Search />} wrapperClassName="grow" />
                    <Button type="submit" variant="secondary">
                      Rechercher
                    </Button>
                  </div>
                  <p className="text-hint text-muted">Au moins deux lettres. Par exemple : Calavi, Cotonou, Borgou.</p>
                </form>

                <ActionForm action={requestSchoolChange} onReset={(ev) => ev.preventDefault()} className="flex flex-col gap-5">
                  <input type="hidden" name="studentId" value={s.id} />
                  {q.length < 2 ? (
                    <p className="text-sm text-muted">Tapez le nom de l&apos;école, de sa commune ou de son département, puis « Rechercher ».</p>
                  ) : schools.length === 0 ? (
                    <EmptyState variant="no-results" title="Aucun établissement ouvert ne correspond" description="Vérifiez l'orthographe ou cherchez par commune." />
                  ) : (
                    <div>
                      <ChoiceGroup legend={`Établissements trouvés (${schools.length})`}>
                        {schools.map((sc) => (
                          <Radio
                            key={sc.id}
                            name="toSchoolId"
                            value={sc.id}
                            defaultChecked={schools.length === 1}
                            label={sc.name}
                            description={`${sc.commune.name}, ${sc.commune.department.name} · ${CYCLES[sc.cycle]}`}
                          />
                        ))}
                      </ChoiceGroup>
                      <FieldError name="toSchoolId" />
                    </div>
                  )}
                  <FormField label="Motif" name="reason" required>
                    <Textarea rows={3} maxLength={300} placeholder="Par exemple : la famille déménage à Abomey-Calavi" />
                  </FormField>
                  <div>
                    <ChoiceGroup legend="Transmettre le dossier scolaire (bulletins, présences) ?" info="Le parent le voit au moment de donner son accord." orientation="horizontal">
                      <Radio name="shareHistory" value="yes" defaultChecked label="Oui" />
                      <Radio name="shareHistory" value="no" label="Non" />
                    </ChoiceGroup>
                    <FieldError name="shareHistory" />
                  </div>
                  {guardian?.userId ? (
                    <Alert tone="info">
                      {guardian.firstName} {guardian.lastName}, parent principal, recevra la demande dans Classéo et répondra oui ou non.
                    </Alert>
                  ) : (
                    <Checkbox
                      name="paperConsent"
                      label={guardian ? `${guardian.firstName} ${guardian.lastName} a signé son accord sur papier` : "Le parent a signé son accord sur papier"}
                      description={`Le parent principal n'a pas de compte Classéo${guardian ? ` (téléphone ${guardian.phone})` : ""}. Gardez le papier signé dans le dossier de l'élève.`}
                    />
                  )}
                  <div className="flex justify-end gap-2 max-sm:*:flex-1">
                    <ButtonLink href={`/espace/eleves/${s.id}`} variant="secondary">
                      Annuler
                    </ButtonLink>
                    <SubmitButton disabled={schools.length === 0}>Envoyer la demande</SubmitButton>
                  </div>
                </ActionForm>
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
