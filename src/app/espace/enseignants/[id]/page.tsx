import { BookOpen, Clock, IdCard, LayoutGrid, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/kit/page-header";
import { StatCard, StatGrid } from "@/components/kit/stat-card";
import { EmptyState } from "@/components/kit/states";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { shortDate } from "@/features/students/labels";
import { EditTeacherDialog } from "@/features/teachers/components/teacher-forms";
import { FILE_LEVELS } from "@/features/teachers/file-rules";
import { getTeacher } from "@/features/teachers/queries";
import { can, requirePermission } from "@/lib/auth/authorize";
import { ATTENDANCE_LABELS, dateToIso } from "@/lib/domain/attendance";
import { creatableStatuses, PAYER_LABELS, payerOf, TEACHER_STATUS_LABELS } from "@/lib/domain/teacher-status";
import { PdfDownloadLink } from "@/lib/pdf/download-link";
import { formatDateTime, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Enseignant" };

export default async function TeacherPage(props: PageProps<"/espace/enseignants/[id]">) {
  const user = await requirePermission("teacher:view");
  const { id } = await props.params;
  const t = await getTeacher(user, id);
  if (!t) notFound();
  const name = `${t.firstName} ${t.lastName}`;
  const hours = t.assignments.reduce((a, x) => a + x.weeklyHours, 0);
  const students = new Map(t.assignments.map((a) => [a.classroom.id, a.classroom._count.enrollments]));

  return (
    <>
      <nav aria-label="Fil d'Ariane" className="mb-2 text-sm text-muted max-lg:hidden">
        <Link href="/espace/enseignants" className="hover:underline">
          Enseignants
        </Link>{" "}
        / {name}
      </nav>
      <PageHeader
        title={name}
        description={[
          `Matricule ${t.matricule}`,
          t.school.name,
          t.specialty,
          t.status ? TEACHER_STATUS_LABELS[t.status] : "Statut non renseigné",
          t.status ? `payé par : ${PAYER_LABELS[payerOf(t.status)!]}` : null,
          t.profile?.stateMatricule ? `matricule de l'État ${t.profile.stateMatricule}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            {t.profileId && FILE_LEVELS.includes(user.scope.level) && (
              <ButtonLink href={`/espace/enseignants/registre/${t.profileId}`} variant="secondary">
                <IdCard aria-hidden /> Fiche de l&apos;enseignant
              </ButtonLink>
            )}
            {can(user, "timetable:view") && (
              <PdfDownloadLink href={`/api/pdf/emploi-du-temps?enseignant=${t.id}`} label="Emploi du temps (PDF)" description={`emploi du temps de ${name}`} />
            )}
            {can(user, "teacher:update") && (
              <EditTeacherDialog
                values={{
                  id: t.id,
                  lastName: t.lastName,
                  firstName: t.firstName,
                  gender: t.gender,
                  phone: t.phone,
                  specialty: t.specialty,
                  hiredAt: t.hiredAt ? dateToIso(t.hiredAt) : null,
                  isActive: t.isActive,
                  npi: t.profile?.npi ?? null,
                  status: t.status,
                  stateStatus: t.profile?.stateStatus ?? null,
                }}
                statusOptions={creatableStatuses(t.school.sector)}
              />
            )}
          </>
        }
      />
      <StatGrid>
        <StatCard label="Classes" value={formatNumber(students.size)} icon={LayoutGrid} />
        <StatCard label="Élèves suivis" value={formatNumber([...students.values()].reduce((a, b) => a + b, 0))} icon={Users} tone="info" />
        <StatCard label="Heures par semaine" value={formatNumber(hours)} icon={Clock} tone="accent" />
        <StatCard label="Professeur principal" value={t.mainClasses.length ? t.mainClasses.map((c) => c.name).join(", ") : "–"} icon={BookOpen} tone="warning" />
      </StatGrid>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Enseignements de l&apos;année</CardTitle>
          </CardHeader>
          {t.assignments.length === 0 ? (
            <EmptyState title="Aucune matière attribuée" description="Attribuez des matières depuis la page d'une classe." />
          ) : (
            <Table>
              <caption className="sr-only">Matières enseignées par classe</caption>
              <THead>
                <tr>
                  <TH>Classe</TH>
                  <TH>Matière</TH>
                  <TH className="text-right">Coef.</TH>
                  <TH className="text-right max-sm:hidden">H/sem.</TH>
                  <TH className="max-md:hidden">Fiches de notes</TH>
                </tr>
              </THead>
              <tbody>
                {t.assignments.map((a) => (
                  <TR key={a.id}>
                    <TD className="whitespace-nowrap">
                      <Link href={`/espace/classes/${a.classroom.id}`} className="font-semibold text-primary hover:underline">
                        {a.classroom.name}
                      </Link>
                    </TD>
                    <TD>{a.subject.name}</TD>
                    <TD className="text-right tabular-nums">{a.coefficient}</TD>
                    <TD className="text-right tabular-nums max-sm:hidden">{a.weeklyHours}</TD>
                    <TD className="max-md:hidden">
                      <span className="flex flex-wrap gap-1">
                        {a.gradeSheets.length
                          ? a.gradeSheets.map((s) =>
                              can(user, "grade:view") ? (
                                <Link key={s.id} href={`/espace/notes/${s.id}`}>
                                  <Badge tone={s.isLocked ? "neutral" : "success"}>
                                    {s.period.name}
                                    {s.isLocked ? ", verrouillée" : ""}
                                  </Badge>
                                </Link>
                              ) : (
                                <Badge key={s.id}>{s.period.name}</Badge>
                              ),
                            )
                          : "–"}
                      </span>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Coordonnées</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm [&_dd]:min-w-0 [&_dd]:break-words">
                <dt className="text-muted">Téléphone</dt>
                <dd>{t.phone ? <a href={`tel:${t.phone}`} className="font-mono hover:underline">{t.phone}</a> : "–"}</dd>
                <dt className="text-muted">Embauche</dt>
                <dd>{t.hiredAt ? shortDate(t.hiredAt) : "–"}</dd>
                <dt className="text-muted">NPI</dt>
                <dd className="font-mono">{t.profile?.npi ?? "Non renseigné"}</dd>
                <dt className="text-muted">Compte</dt>
                <dd className="break-all">
                  {t.user ? (
                    <>
                      <span className="font-mono">{t.user.username}</span>
                      {t.user.email && <span className="block text-muted">{t.user.email}</span>}
                    </>
                  ) : (
                    "Aucun compte"
                  )}
                </dd>
                {(t.profile?.teachers.length ?? 0) > 1 && (
                  <>
                    <dt className="text-muted">Établissements</dt>
                    <dd>
                      <ul className="flex flex-col gap-0.5">
                        {t.profile!.teachers.map((a) => (
                          <li key={a.id}>
                            {a.school.name}
                            {a.schoolId === t.schoolId && <span className="text-muted"> (cette fiche)</span>}
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </>
                )}
                {t.user?.lastLoginAt && (
                  <>
                    <dt className="text-muted">Dernière connexion</dt>
                    <dd>{formatDateTime(t.user.lastLoginAt)}</dd>
                  </>
                )}
                <dt className="text-muted">Statut</dt>
                <dd>
                  <Badge tone={t.isActive ? "success" : "neutral"}>{t.isActive ? "En activité" : "Inactif"}</Badge>
                </dd>
              </dl>
            </CardBody>
          </Card>
          {can(user, "attendance:view") && (
            <Card>
              <CardHeader>
                <CardTitle>Présence récente</CardTitle>
              </CardHeader>
              {t.attendances.length ? (
                <ul className="divide-y divide-border text-sm">
                  {t.attendances.map((a) => (
                    <li key={a.date.toISOString()} className="flex items-center justify-between gap-2 px-5 py-2.5">
                      <span className="tabular-nums">{shortDate(a.date)}</span>
                      <span className="flex items-center gap-2">
                        {a.reason && <span className="text-muted">{a.reason}</span>}
                        <Badge tone={a.status === "PRESENT" ? "success" : a.status === "ABSENT" ? "danger" : "warning"}>{ATTENDANCE_LABELS[a.status]}</Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="Aucune présence enregistrée" />
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
