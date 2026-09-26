import { Search, Share2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { ConfirmButton } from "@/components/kit/confirm-button";
import { FormField } from "@/components/kit/form-field";
import { PageHeader } from "@/components/kit/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, ChoiceGroup, Input, Label, Radio } from "@/components/ui/input";
import { grantRecordAccess, revokeRecordAccess } from "@/features/student-history/actions";
import { HistoryView } from "@/features/student-history/components/history-view";
import { currentHolder, studentHistory } from "@/features/student-history/queries";
import { StudentAvatar } from "@/features/students/components/student-avatar";
import { FieldError } from "@/features/transfers/components/field-error";
import { searchSchools } from "@/features/transfers/queries";
import { can, requirePermission } from "@/lib/auth/authorize";
import { todayIso } from "@/lib/domain/attendance";
import { param } from "@/lib/list";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Parcours de l'élève" };

export default async function StudentHistoryPage(props: PageProps<"/espace/eleves/[id]/parcours">) {
  const user = await requirePermission("student:view");
  const { id } = await props.params;
  const sp = await props.searchParams;
  const history = await studentHistory(user, id);
  if (!history) notFound();
  const s = history.student;
  const name = `${s.firstName} ${s.lastName}`;
  const holder = can(user, "student:update") ? await currentHolder(user, s.id) : null;
  const q = (param(sp, "partage") ?? "").trim().slice(0, 80);
  const schools = holder && q.length >= 2 ? await searchSchools({ q, excludeId: holder }) : [];
  const mySchool = user.scope.level === "SCHOOL" ? user.scope.schoolId : null;

  return (
    <>
      <nav aria-label="Fil d'Ariane" className="mb-2 text-sm text-muted max-lg:hidden">
        <Link href="/espace/eleves" className="hover:underline">
          Élèves
        </Link>{" "}
        /{" "}
        <Link href={`/espace/eleves/${s.id}`} className="hover:underline">
          {name}
        </Link>{" "}
        / Parcours
      </nav>
      <PageHeader title={`Parcours de ${name}`} description={`Matricule ${s.matricule}`} info={`Toutes les années, tous les établissements${history.full ? "" : " de votre périmètre"}.`} />
      <div className="mb-6 flex items-center gap-3">
        <StudentAvatar name={name} photoFileId={s.photoFileId} className="size-14 text-lg" />
        {history.full ? <Badge tone="success">Dossier complet</Badge> : <Badge>Dossier limité à votre périmètre</Badge>}
      </div>

      <HistoryView
        history={history}
        transferHref={(tid) => `/espace/transferts/${tid}`}
        reportCardHref={(c, schoolId) => (can(user, "report_card:view") && (!mySchool || mySchool === schoolId) ? `/espace/bulletins/${c.enrollmentId}/${c.periodId}` : null)}
      />

      {holder && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="size-5 text-primary" aria-hidden /> Partage du dossier scolaire
            </CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-5">
            <p className="text-sm text-muted">
              Un autre établissement peut lire tout le parcours de {s.firstName} (par exemple une école où l&apos;élève s&apos;inscrit sans transfert), avec l&apos;accord du parent.
            </p>
            {history.accesses.length > 0 && (
              <ul className="divide-y divide-border rounded-control border border-border">
                {history.accesses.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <span>
                      <span className="font-semibold">{a.school.name}</span>
                      <span className="block text-muted">
                        Depuis le {formatDate(a.createdAt)}
                        {a.expiresAt ? `, jusqu'au ${formatDate(a.expiresAt)}` : ", sans date de fin"}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge tone={a.valid ? "success" : "neutral"}>{a.valid ? "Actif" : "Expiré"}</Badge>
                      {a.school.id !== holder && (
                        <ConfirmButton
                          action={revokeRecordAccess}
                          fields={{ studentId: s.id, accessId: a.id }}
                          title={`Retirer l'accès de ${a.school.name} ?`}
                          description="L'établissement ne pourra plus lire le parcours de l'élève hors de ses murs."
                          confirmLabel="Retirer l'accès"
                          variant="danger-ghost"
                          size="sm"
                        >
                          Retirer
                        </ConfirmButton>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <form method="get" role="search" className="flex flex-col gap-1.5">
              <Label htmlFor="share-search">Partager avec un établissement</Label>
              <div className="flex gap-2">
                <Input id="share-search" name="partage" type="search" defaultValue={q} placeholder="Nom, commune ou département" autoComplete="off" leading={<Search />} wrapperClassName="grow" />
                <Button type="submit" variant="secondary">
                  Rechercher
                </Button>
              </div>
            </form>
            {q.length >= 2 && (
              <ActionForm action={grantRecordAccess} onReset={(ev) => ev.preventDefault()} className="flex flex-col gap-4">
                <input type="hidden" name="studentId" value={s.id} />
                {schools.length ? (
                  <div>
                    <ChoiceGroup legend="Établissement">
                      {schools.map((sc) => (
                        <Radio key={sc.id} name="schoolId" value={sc.id} defaultChecked={schools.length === 1} label={sc.name} description={`${sc.commune.name}, ${sc.commune.department.name}`} />
                      ))}
                    </ChoiceGroup>
                    <FieldError name="schoolId" />
                  </div>
                ) : (
                  <p className="text-sm text-muted">Aucun établissement ouvert ne correspond à « {q} ».</p>
                )}
                <FormField label="Jusqu'au (facultatif)" name="expiresOn" hint="Laissez vide pour un accès sans date de fin.">
                  <Input type="date" min={todayIso()} className="sm:max-w-56" />
                </FormField>
                <div>
                  <Checkbox name="guardianConsent" label="Le parent principal a donné son accord" description="Par écrit ou dans Classéo. Gardez la trace de cet accord." />
                  <FieldError name="guardianConsent" />
                </div>
                <div className="flex justify-end">
                  <SubmitButton disabled={!schools.length}>Partager le dossier</SubmitButton>
                </div>
              </ActionForm>
            )}
          </CardBody>
        </Card>
      )}
    </>
  );
}
