import { CalendarCheck, ClipboardCheck, FileText, GraduationCap, NotebookPen, Percent, Trash2, TrendingUp, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AverageLevel } from "@/components/kit/level";
import { PageHeader } from "@/components/kit/page-header";
import { StatCard, StatGrid } from "@/components/kit/stat-card";
import { EmptyState } from "@/components/kit/states";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { getCurrentPeriod, schoolPeriodicity } from "@/features/classes/academic";
import { deleteAssignment, deleteClassroom } from "@/features/classes/actions";
import { AssignmentDialog, EditClassDialog } from "@/features/classes/components/class-forms";
import { ConfirmButton } from "@/components/kit/confirm-button";
import { classFormOptions, getClassroom } from "@/features/classes/queries";
import { computeClassCards } from "@/features/report-cards/compute";
import { DISABILITY_LABELS } from "@/features/students/labels";
import { can, requirePermission } from "@/lib/auth/authorize";
import { attendanceRate, isoToDate, schoolWeek, todayIso } from "@/lib/domain/attendance";
import { db } from "@/lib/db";
import { PdfDownloadLink } from "@/lib/pdf/download-link";
import { formatDate, formatPercent } from "@/lib/utils";
import { shortDate } from "@/features/students/labels";

export const metadata: Metadata = { title: "Classe" };

export default async function ClassPage(props: PageProps<"/espace/classes/[id]">) {
  const user = await requirePermission("class:view");
  const { id } = await props.params;
  const classroom = await getClassroom(user, id);
  if (!classroom) notFound();

  const period = await getCurrentPeriod(await schoolPeriodicity(classroom.schoolId));
  const week = schoolWeek(todayIso());
  const canUpdate = can(user, "class:update");
  // Averages and attendance need their own rights: seeing a class (accountant,
  // secretary) is not reading its results.
  const showGrades = can(user, "grade:view");
  const showAttendance = can(user, "attendance:view");
  const [computed, weekStatuses, options] = await Promise.all([
    showGrades && period && classroom.academicYear.isActive ? computeClassCards(classroom.id, period.id) : null,
    showAttendance
      ? db.studentAttendance.groupBy({
          by: ["status"],
          where: { enrollment: { classroomId: classroom.id, status: "ACTIVE" }, date: { gte: isoToDate(week.from), lte: isoToDate(week.to) } },
          _count: { _all: true },
        })
      : [],
    canUpdate ? classFormOptions(user) : null,
  ]);
  const active = classroom.academicYear.isActive;
  const documents = [
    can(user, "student:view") && { href: `/api/pdf/liste-de-classe/${classroom.id}`, label: "Liste de classe", description: `élèves de la ${classroom.name}, en PDF` },
    can(user, "attendance:view") &&
      active && { href: `/api/pdf/fiche-appel/${classroom.id}?date=${todayIso()}`, label: "Fiche d'appel", description: `fiche d'appel du jour, ${classroom.name}, en PDF` },
    can(user, "timetable:view") &&
      active && { href: `/api/pdf/emploi-du-temps?classe=${classroom.id}`, label: "Emploi du temps", description: `emploi du temps de la ${classroom.name}, en PDF` },
    can(user, "report_card:export") &&
      period &&
      active &&
      classroom.enrollments.length > 0 && {
        href: `/api/pdf/bulletins?classe=${classroom.id}&periode=${period.id}`,
        label: "Bulletins",
        description: `bulletins de la ${classroom.name}, ${period.name}, en PDF`,
      },
  ].filter((d): d is { href: string; label: string; description: string } => !!d);
  const weekRate = attendanceRate(Object.fromEntries(weekStatuses.map((s) => [s.status, s._count._all])));
  const girls = classroom.enrollments.filter((e) => e.student.gender === "F").length;
  const size = classroom.enrollments.length;

  return (
    <>
      <nav aria-label="Fil d'Ariane" className="mb-2 text-sm text-muted max-lg:hidden">
        <Link href="/espace/classes" className="hover:underline">
          Classes
        </Link>{" "}
        / {classroom.name}
      </nav>
      <PageHeader
        title={`Classe de ${classroom.name}`}
        description={`${classroom.school.name} · niveau ${classroom.level.name} · année ${classroom.academicYear.label} · professeur principal : ${
          classroom.mainTeacher ? `${classroom.mainTeacher.firstName} ${classroom.mainTeacher.lastName}` : "non désigné"
        }`}
        actions={
          <>
            {options && (
              <EditClassDialog
                options={options}
                values={{ id: classroom.id, name: classroom.name, levelId: classroom.levelId, capacity: classroom.capacity, mainTeacherId: classroom.mainTeacherId }}
              />
            )}
            {can(user, "class:delete") && size === 0 && (
              <ConfirmButton
                action={deleteClassroom}
                fields={{ id: classroom.id }}
                title={`Supprimer la ${classroom.name} ?`}
                description="La classe et ses matières seront supprimées. Cette action est définitive."
                confirmLabel="Supprimer"
              >
                <Trash2 aria-hidden /> Supprimer
              </ConfirmButton>
            )}
          </>
        }
      />

      <StatGrid>
        <StatCard label="Effectif" value={`${size} / ${classroom.capacity}`} hint={`${girls} filles, ${size - girls} garçons`} icon={Users} />
        {showGrades && (
          <>
            <StatCard
              label={`Moyenne de classe${period ? `, ${period.name}` : ""}`}
              value={computed?.summary.classAverage != null ? `${computed.summary.classAverage.toFixed(2).replace(".", ",")}/20` : "–"}
              hint={computed ? `${computed.summary.ranked} élèves classés` : undefined}
              icon={TrendingUp}
              tone="info"
            />
            <StatCard label="Taux de réussite" value={formatPercent(computed?.summary.passRate ?? null)} hint="Moyenne générale au moins égale à 10" icon={Percent} tone="accent" />
          </>
        )}
        {showAttendance && (
          <StatCard label="Présence cette semaine" value={formatPercent(weekRate)} hint={`Du ${formatDate(week.from)} au ${formatDate(week.to)}`} icon={CalendarCheck} tone="warning" />
        )}
      </StatGrid>

      <nav aria-label="Pages de la classe" className="mt-4 grid grid-cols-2 gap-2 *:min-w-0 sm:flex sm:flex-wrap max-sm:[&>*:last-child:nth-child(odd)]:col-span-2">
        {can(user, "grade:view") && (
          <ButtonLink href={`/espace/notes?classe=${classroom.id}`} variant="secondary">
            <NotebookPen aria-hidden /> Fiches de notes
          </ButtonLink>
        )}
        {can(user, "attendance:view") && (
          <ButtonLink href={`/espace/presences?classe=${classroom.id}`} variant="secondary">
            <ClipboardCheck aria-hidden /> Présences
          </ButtonLink>
        )}
        {(can(user, "report_card:publish") || can(user, "report_card:export")) && (
          <ButtonLink href={`/espace/bulletins?classe=${classroom.id}`} variant="secondary">
            <FileText aria-hidden /> Bulletins
          </ButtonLink>
        )}
      </nav>
      {documents.length > 0 && (
        <section aria-labelledby="class-documents" className="mt-4">
          <h2 id="class-documents" className="mb-2 text-sm font-semibold text-muted">
            Documents PDF
          </h2>
          <div className="grid grid-cols-2 gap-2 *:min-w-0 sm:flex sm:flex-wrap max-sm:[&>*:last-child:nth-child(odd)]:col-span-2">
            {documents.map((d) => (
              <PdfDownloadLink key={d.href} href={d.href} label={d.label} description={d.description} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-6 flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Matières et enseignants</CardTitle>
            {options && <AssignmentDialog classroomId={classroom.id} options={options} />}
          </CardHeader>
          {classroom.assignments.length === 0 ? (
            <EmptyState title="Aucune matière" description="Ajoutez les matières enseignées dans cette classe." />
          ) : (
            <Table cards>
              <caption className="sr-only">Matières de la classe</caption>
              <THead>
                <tr>
                  <TH>Matière</TH>
                  <TH>Enseignant</TH>
                  <TH className="text-right">Coef.</TH>
                  <TH className="text-right">H/sem.</TH>
                  {options && <TH className="text-right">Actions</TH>}
                </tr>
              </THead>
              <tbody>
                {classroom.assignments.map((a) => (
                  <TR key={a.id}>
                    <TD className="font-medium" data-label="Matière" data-primary>
                      {a.subject.name}
                    </TD>
                    <TD data-label="Enseignant">{a.teacher ? `${a.teacher.firstName} ${a.teacher.lastName}` : <span className="text-muted">À désigner</span>}</TD>
                    <TD className="text-right tabular-nums" data-label="Coefficient">
                      {a.coefficient}
                    </TD>
                    <TD className="text-right tabular-nums" data-label="Heures par semaine">
                      {a.weeklyHours}
                    </TD>
                    {options && (
                      <TD className="text-right whitespace-nowrap" data-actions>
                        <AssignmentDialog
                          classroomId={classroom.id}
                          options={options}
                          values={{ subjectId: a.subjectId, subjectName: a.subject.name, teacherId: a.teacherId, coefficient: a.coefficient, weeklyHours: a.weeklyHours }}
                        />
                        <ConfirmButton
                          action={deleteAssignment}
                          fields={{ id: a.id }}
                          title={`Retirer ${a.subject.name} ?`}
                          description="La matière et ses fiches de notes vides seront retirées de la classe. Impossible si des notes ont été saisies."
                          confirmLabel="Retirer"
                          variant="ghost"
                          size="sm"
                          label={`Retirer ${a.subject.name}`}
                        >
                          <Trash2 aria-hidden />
                        </ConfirmButton>
                      </TD>
                    )}
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Élèves ({size})</CardTitle>
          </CardHeader>
          {size === 0 ? (
            <EmptyState icon={<GraduationCap className="size-7" />} title="Aucun élève inscrit" description="Les inscriptions se font depuis la page Élèves." />
          ) : (
            <Table>
              <caption className="sr-only">Élèves de la classe</caption>
              <THead>
                <tr>
                  <TH>Élève</TH>
                  <TH className="max-sm:hidden">Matricule</TH>
                  <TH className="max-md:hidden">Naissance</TH>
                  {showGrades && <TH>Moyenne</TH>}
                </tr>
              </THead>
              <tbody>
                {classroom.enrollments.map((e) => {
                  const card = computed?.cards.find((c) => c.enrollmentId === e.id);
                  return (
                    <TR key={e.id}>
                      <TD>
                        <Link href={`/espace/eleves/${e.student.id}`} className="font-semibold text-primary hover:underline">
                          {e.student.lastName} {e.student.firstName}
                        </Link>
                        <span className="ml-2 inline-flex flex-wrap gap-1">
                          {e.isRepeating && <Badge tone="neutral">Redoublant</Badge>}
                          {e.student.disabilities.map((d) => (
                            <Badge key={d} tone="info">
                              {DISABILITY_LABELS[d]}
                            </Badge>
                          ))}
                        </span>
                      </TD>
                      <TD className="font-mono text-xs max-sm:hidden">{e.student.matricule}</TD>
                      <TD className="whitespace-nowrap tabular-nums max-md:hidden">{shortDate(e.student.birthDate)}</TD>
                      {showGrades && (
                        <TD className="whitespace-nowrap">
                          <AverageLevel average={card?.generalAverage ?? null} />
                        </TD>
                      )}
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          )}
          {computed && computed.missingSheets.length > 0 && (
            <CardBody className="border-t border-border text-sm text-muted">
              Matières sans fiche de notes ce trimestre : {computed.missingSheets.join(", ")}.
            </CardBody>
          )}
        </Card>
      </div>
    </>
  );
}
