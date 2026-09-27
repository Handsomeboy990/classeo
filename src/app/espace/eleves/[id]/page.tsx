import { ArrowLeftRight, CalendarCheck, History, Pencil, Trophy, UserX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmButton } from "@/components/kit/confirm-button";
import { FormDialog } from "@/components/kit/form-dialog";
import { ImageUpload } from "@/components/kit/image-upload";
import { AverageLevel } from "@/components/kit/level";
import { LineChart } from "@/components/kit/line-chart";
import { MoreActions } from "@/components/kit/more-actions";
import { PageHeader } from "@/components/kit/page-header";
import { StatCard, StatGrid } from "@/components/kit/stat-card";
import { EmptyState } from "@/components/kit/states";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { EnrollmentStatusActions } from "@/features/students/components/enrollment-status";
import { StudentAvatar } from "@/features/students/components/student-avatar";
import { removeStudentPhoto, updateStudentPhoto } from "@/features/students/photo-actions";
import { transfersOfStudent } from "@/features/transfers/queries";
import { TransferStatusBadge } from "@/features/transfers/components/transfer-timeline";
import { isPending, KIND_LABELS } from "@/features/transfers/logic";
import { isEnabled } from "@/lib/features";
import { fileUrl } from "@/lib/files";
import { CHANNEL_LABELS, DISABILITY_LABELS, ENROLLMENT_STATUS_LABELS, GENDER_LABELS, shortDate } from "@/features/students/labels";
import { getStudentProfile } from "@/features/students/queries";
import { can, requirePermission } from "@/lib/auth/authorize";
import { ATTENDANCE_LABELS, isoToDate, todayIso } from "@/lib/domain/attendance";
import { formatRank } from "@/lib/domain/report-card";
import { param } from "@/lib/list";
import { shortPeriodName } from "@/lib/domain/periodicity";
import { PdfDownloadLink } from "@/lib/pdf/download-link";
import { formatAverage, formatDate, formatNumber, formatPercent } from "@/lib/utils";
import { plural } from "@/features/classes/text";

export const metadata: Metadata = { title: "Élève" };

export default async function StudentPage(props: PageProps<"/espace/eleves/[id]">) {
  const user = await requirePermission("student:view");
  const { id } = await props.params;
  const sp = await props.searchParams;
  const profile = await getStudentProfile(user, id);
  if (!profile) notFound();
  const { rights, student, current, period, grades, general, attendance, attendanceCounts, attendanceRate, reportCards } = profile;
  const name = `${student.firstName} ${student.lastName}`;
  const canUpdate = can(user, "student:update");
  const age = Math.floor((isoToDate(todayIso()).getTime() - student.birthDate.getTime()) / (365.25 * 86400000));

  // Header actions: the two most used (edit, history) stay in view, the
  // others (documents, transfer, withdrawal) go behind "Plus d'actions", so a long
  // name keeps its width at 1366 and 1440 px.
  const active = current && current.academicYear.isActive ? current : null;
  const editable = canUpdate && active ? active : null;
  const [transfersOn, transfers] = await Promise.all([isEnabled("students.transfers"), transfersOfStudent(user, student.id)]);
  const pendingTransfer = transfers.find((t) => isPending(t.status));
  const canTransfer = transfersOn && editable && editable.status === "ACTIVE" && user.scope.level === "SCHOOL" && editable.schoolId === user.scope.schoolId && !pendingTransfer;
  const actions = [
    editable && (
      <ButtonLink key="edit" href={`/espace/eleves/${student.id}/modifier`} variant="secondary">
        <Pencil aria-hidden /> Modifier
      </ButtonLink>
    ),
    <ButtonLink key="history" href={`/espace/eleves/${student.id}/parcours`} variant="secondary">
      <History aria-hidden /> Parcours
    </ButtonLink>,
    active && active.status === "ACTIVE" && (
      <PdfDownloadLink key="attestation" href={`/api/pdf/attestation/${student.id}`} label="Attestation (PDF)" description={`attestation de scolarité de ${name}`} />
    ),
    rights.grades && active && period && (
      <PdfDownloadLink key="releve" href={`/api/pdf/releve/${student.id}`} label="Relevé de notes (PDF)" description={`relevé de notes de ${name}, ${period.name}`} />
    ),
    canTransfer && (
      <ButtonLink key="transfer" href={`/espace/transferts/nouveau?eleve=${student.id}`} variant="secondary">
        <ArrowLeftRight aria-hidden /> Transférer
      </ButtonLink>
    ),
  ].filter(Boolean);
  const shown = actions.slice(0, 2);
  const more = actions.slice(2);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Élèves", href: "/espace/eleves" }, { label: name }]}
        title={name}
        description={`Matricule ${student.matricule}${current ? ` · ${current.classroom.name}, ${current.school.name} · ${ENROLLMENT_STATUS_LABELS[current.status]}` : ""}`}
        actionsPlacement="below"
        actions={
          (shown.length > 0 || more.length > 0 || editable) && (
            <>
              {shown}
              {(more.length > 0 || editable) && (
                <MoreActions>
                  {more}
                  {editable && <EnrollmentStatusActions enrollmentId={editable.id} status={editable.status} name={name} className={editable.classroom.name} />}
                </MoreActions>
              )}
            </>
          )
        }
      />
      {pendingTransfer && (
        <Alert
          tone="info"
          className="mb-4"
          title={`${KIND_LABELS[pendingTransfer.kind]} en cours`}
          action={
            <ButtonLink href={`/espace/transferts/${pendingTransfer.id}`} variant="secondary" size="sm">
              Voir le transfert
            </ButtonLink>
          }
        >
          {pendingTransfer.fromSchool.name} vers {pendingTransfer.toSchool.name} · <TransferStatusBadge status={pendingTransfer.status} />
        </Alert>
      )}
      {param(sp, "inscrit") && (
        <Alert tone="success" className="mb-4">
          Inscription enregistrée. Matricule attribué : <strong>{student.matricule}</strong>.
        </Alert>
      )}

      {(rights.grades || rights.attendance) && (
        <StatGrid>
          {rights.grades && (
            <>
              <div className="rounded-card border border-border bg-surface p-5">
                <p className="text-sm font-medium text-muted">Moyenne générale{period ? `, ${period.name}` : ""}</p>
                <div className="mt-3">
                  <span className="sm:hidden">
                    <AverageLevel average={general?.average ?? null} />
                  </span>
                  <span className="max-sm:hidden">
                    <AverageLevel average={general?.average ?? null} size="lg" />
                  </span>
                </div>
              </div>
              <StatCard label="Rang dans la classe" value={general?.rank ? formatRank(general.rank) : "–"} hint={general ? `sur ${general.classSize} élèves` : undefined} icon={Trophy} tone="accent" />
            </>
          )}
          {rights.attendance && (
            <>
              <StatCard label="Taux de présence" value={formatPercent(attendanceRate)} hint="Depuis la rentrée" icon={CalendarCheck} tone="info" />
              <StatCard
                label="Absences"
                value={formatNumber(attendanceCounts.ABSENT ?? 0)}
                hint={`${plural(attendanceCounts.LATE ?? 0, "retard", "retards")}, ${plural(attendanceCounts.EXCUSED ?? 0, "excusée", "excusées")}, en demi-journées`}
                icon={UserX}
                tone="danger"
              />
            </>
          )}
        </StatGrid>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Identité</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="mb-5 flex flex-wrap items-center gap-4">
              <StudentAvatar name={name} photoFileId={student.photoFileId} className="size-24 text-2xl" />
              {editable && (
                <div className="flex flex-wrap gap-2">
                  <FormDialog
                    action={updateStudentPhoto}
                    trigger={student.photoFileId ? "Changer la photo" : "Ajouter une photo"}
                    triggerVariant="secondary"
                    triggerSize="sm"
                    title={`Photo de ${name}`}
                    description="Facultative. Elle apparaît sur la fiche, les listes, le bulletin, l'attestation et l'espace des parents."
                  >
                    <input type="hidden" name="studentId" value={student.id} />
                    <ImageUpload name="photo" label="Photo" currentUrl={fileUrl(student.photoFileId)} shape="circle" maxSide={480} hint="JPEG, PNG ou WebP. Elle est réduite avant l'envoi." />
                  </FormDialog>
                  {student.photoFileId && (
                    <ConfirmButton
                      action={removeStudentPhoto}
                      fields={{ studentId: student.id }}
                      title="Retirer la photo ?"
                      description="Les initiales de l'élève seront affichées à la place."
                      confirmLabel="Retirer"
                      variant="danger-ghost"
                      size="sm"
                    >
                      Retirer la photo
                    </ConfirmButton>
                  )}
                </div>
              )}
            </div>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm [&_dd]:min-w-0 [&_dd]:break-words">
              <dt className="text-muted">Sexe</dt>
              <dd>{GENDER_LABELS[student.gender]}</dd>
              <dt className="text-muted">Naissance</dt>
              <dd>
                {shortDate(student.birthDate)} ({age} ans){student.birthPlace ? `, ${student.birthPlace}` : ""}
              </dd>
              <dt className="text-muted">Compte élève</dt>
              <dd className="break-all">{student.user ? student.user.email : "Aucun"}</dd>
              <dt className="text-muted">Besoins particuliers</dt>
              <dd className="flex flex-wrap gap-1">
                {student.disabilities.length ? (
                  student.disabilities.map((d) => (
                    <Badge key={d} tone="info">
                      {DISABILITY_LABELS[d]}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted">Aucun signalé</span>
                )}
              </dd>
              {current && (
                <>
                  <dt className="text-muted">Professeur principal</dt>
                  <dd>{current.classroom.mainTeacher ? `${current.classroom.mainTeacher.firstName} ${current.classroom.mainTeacher.lastName}` : "Non désigné"}</dd>
                </>
              )}
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parents et tuteurs</CardTitle>
          </CardHeader>
          {student.guardians.length ? (
            <ul className="divide-y divide-border">
              {student.guardians.map(({ guardian: g, relationship, isPrimary }) => (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <div>
                    {can(user, "parent:view") ? (
                      <Link href={`/espace/parents/${g.id}`} className="font-semibold text-primary hover:underline">
                        {g.firstName} {g.lastName}
                      </Link>
                    ) : (
                      <span className="font-semibold">
                        {g.firstName} {g.lastName}
                      </span>
                    )}
                    <span className="block text-muted">
                      {relationship}
                      {g.profession ? ` · ${g.profession}` : ""}
                    </span>
                  </div>
                  <div className="sm:text-right">
                    <a href={`tel:${g.phone}`} className="font-mono hover:underline">
                      {g.phone}
                    </a>
                    <span className="mt-1 flex flex-wrap gap-1 sm:justify-end">
                      {isPrimary && <Badge tone="success">Principal</Badge>}
                      <Badge>{CHANNEL_LABELS[g.preferredChannel]}</Badge>
                      {g.prefersAudio && <Badge tone="info">Préfère l&apos;audio</Badge>}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Aucun parent renseigné" />
          )}
        </Card>
      </div>

      {rights.grades && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{period ? `Notes, ${period.name}` : "Notes de la période"}</CardTitle>
          </CardHeader>
          {grades.length === 0 ? (
            <EmptyState title="Aucune matière" description="Aucune inscription active cette année." />
          ) : (
            <Table>
              <caption className="sr-only">Moyennes par matière pour la période en cours</caption>
              <THead>
                <tr>
                  <TH>Matière</TH>
                  <TH className="text-right">Coef.</TH>
                  <TH className="text-right max-md:hidden">Interrogations</TH>
                  <TH className="text-right max-md:hidden">Devoirs</TH>
                  <TH className="text-right max-md:hidden">Composition</TH>
                  <TH>Moyenne</TH>
                </tr>
              </THead>
              <tbody>
                {grades.map((g) => (
                  <TR key={g.id}>
                    <TD>
                      <span className="font-medium">{g.subject}</span>
                      {g.teacher && <span className="block text-xs text-muted">{g.teacher}</span>}
                    </TD>
                    <TD className="text-right tabular-nums">{g.coefficient}</TD>
                    <TD className="text-right tabular-nums max-md:hidden">{formatAverage(g.interrogationAverage)}</TD>
                    <TD className="text-right tabular-nums max-md:hidden">{formatAverage(g.devoirAverage)}</TD>
                    <TD className="text-right tabular-nums max-md:hidden">{formatAverage(g.compositionAverage)}</TD>
                    <TD className="whitespace-nowrap">{g.hasSheet ? <AverageLevel average={g.average} /> : <span className="text-muted">Fiche non ouverte</span>}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {rights.attendance && (
          <Card>
            <CardHeader>
              <CardTitle>Absences et retards récents</CardTitle>
            </CardHeader>
            {attendance.length === 0 ? (
              <EmptyState title="Aucune absence ni aucun retard depuis la rentrée" />
            ) : (
              <Table>
                <caption className="sr-only">Absences et retards récents</caption>
                <THead>
                  <tr>
                    <TH>Date</TH>
                    <TH>Demi-journée</TH>
                    <TH>Statut</TH>
                    <TH className="max-sm:hidden">Motif</TH>
                  </tr>
                </THead>
                <tbody>
                  {attendance.map((a) => (
                    <TR key={a.id}>
                      <TD className="whitespace-nowrap tabular-nums">{shortDate(a.date)}</TD>
                      <TD>{a.half === "MORNING" ? "Matin" : "Après-midi"}</TD>
                      <TD>
                        <Badge tone={a.status === "ABSENT" ? "danger" : a.status === "LATE" ? "warning" : "info"}>{ATTENDANCE_LABELS[a.status]}</Badge>
                      </TD>
                      <TD className="text-muted max-sm:hidden">{a.reason ?? "–"}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        )}

        {rights.reportCards && (
          <Card>
            <CardHeader>
              <CardTitle>Bulletins publiés</CardTitle>
            </CardHeader>
            {reportCards.length > 1 && (
              <CardBody className="border-b border-border">
                <LineChart
                  label="Évolution de la moyenne générale d'un bulletin à l'autre"
                  labels={[...reportCards].reverse().map((r) => `${shortPeriodName(r.period.name)} ${r.period.academicYear.label.slice(2, 4)}-${r.period.academicYear.label.slice(-2)}`)}
                  series={[{ name: "Moyenne générale", values: [...reportCards].reverse().map((r) => (r.generalAverage === null ? null : Number(r.generalAverage))) }]}
                  min={0}
                  max={20}
                  format={(n) => formatAverage(n).replace(/,00$/, "")}
                  reference={{ value: 10, label: "Moyenne de passage" }}
                />
              </CardBody>
            )}
            {reportCards.length === 0 ? (
              <EmptyState title="Aucun bulletin publié" />
            ) : (
              <ul className="divide-y divide-border">
                {reportCards.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div>
                      <p className="font-semibold">
                        {r.period.name} {r.period.academicYear.label}
                      </p>
                      <p className="text-muted">
                        Rang {formatRank(r.rank)} sur {r.classSize} · publié le {formatDate(r.publishedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <AverageLevel average={r.generalAverage === null ? null : Number(r.generalAverage)} />
                      <Link
                        href={`/espace/bulletins/${r.enrollmentId}/${r.periodId}`}
                        className={buttonVariants({ variant: "secondary", size: "sm" })}
                        aria-label={`Voir le bulletin du ${r.period.name} ${r.period.academicYear.label}`}
                      >
                        Voir
                      </Link>
                      <PdfDownloadLink href={`/api/pdf/bulletin?id=${r.id}`} label="PDF" size="sm" description={`bulletin du ${r.period.name} ${r.period.academicYear.label}`} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Scolarité</CardTitle>
        </CardHeader>
        <ul className="divide-y divide-border">
          {student.enrollments.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
              <span>
                <strong>{e.academicYear.label}</strong> · {e.classroom.name}, {e.school.name}
                {e.isRepeating ? " · redoublant" : ""}
              </span>
              <Badge tone={e.status === "ACTIVE" ? "success" : "warning"}>{ENROLLMENT_STATUS_LABELS[e.status]}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
