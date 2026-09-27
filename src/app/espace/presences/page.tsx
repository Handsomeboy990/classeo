import { CalendarCheck, CalendarDays, Download, School, UserSquare2, UserX } from "lucide-react";
import type { Metadata } from "next";

import { InfoTip } from "@/components/kit/info-tip";
import { BarChart } from "@/components/kit/bar-chart";
import { PageHeader } from "@/components/kit/page-header";
import { StatCard, StatGrid } from "@/components/kit/stat-card";
import { EmptyState } from "@/components/kit/states";
import { Alert } from "@/components/ui/alert";
import { ButtonLink, buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { saveAttendance } from "@/features/attendance/actions";
import { AttendanceRegister } from "@/features/attendance/components/attendance-register";
import { RegisterFilters } from "@/features/attendance/components/register-filters";
import { attendanceStats, mostAbsent, register } from "@/features/attendance/queries";
import { getActiveYear } from "@/features/classes/academic";
import { classroomOptions } from "@/features/classes/queries";
import { can, requirePermission } from "@/lib/auth/authorize";
import { isIsoDate, isWeekend, todayIso } from "@/lib/domain/attendance";
import { param } from "@/lib/list";
import { PdfDownloadLink } from "@/lib/pdf/download-link";
import { formatDate, formatNumber, formatPercent } from "@/lib/utils";

export const metadata: Metadata = { title: "Présences" };

export default async function AttendancePage(props: PageProps<"/espace/presences">) {
  const user = await requirePermission("attendance:view");
  const sp = await props.searchParams;
  const today = todayIso();
  const rawDate = param(sp, "date") ?? "";
  const date = isIsoDate(rawDate) && rawDate <= today ? rawDate : today;
  const half = param(sp, "demi") === "AFTERNOON" ? "AFTERNOON" : "MORNING";

  const [year, classes] = await Promise.all([getActiveYear(), classroomOptions(user)]);
  if (!year || !classes.length) {
    return (
      <>
        <PageHeader title="Présences" />
        <EmptyState title="Aucune classe" description="Aucune classe de l'année active n'est dans votre périmètre." />
      </>
    );
  }
  const classroomId = classes.find((c) => c.id === param(sp, "classe"))?.id ?? classes[0]!.id;
  const [reg, stats, absentees] = await Promise.all([register(user, classroomId, date, half), attendanceStats(user, date, classroomId), mostAbsent(user, year.id)]);
  if (!reg) return <EmptyState title="Classe introuvable" />;
  const editable = can(user, "attendance:create") && reg.classroom.academicYear.isActive;
  const staffAttendance = can(user, "teacher:view");
  const halfLabel = half === "MORNING" ? "matin" : "après-midi";

  return (
    <>
      <PageHeader
        title="Présences"
        description={`Appel de la ${reg.classroom.name}, ${formatDate(date)}, ${halfLabel}`}
        actions={
          <>
            {can(user, "attendance:export") && (
              <a
                href={`/api/export/presences?classe=${classroomId}&du=${stats.week.from}&au=${stats.week.to}`}
                className={buttonVariants({ variant: "secondary" })}
              >
                <Download aria-hidden /> Exporter la semaine
              </a>
            )}
            <PdfDownloadLink
              href={`/api/pdf/fiche-appel/${classroomId}?date=${date}`}
              label="Fiche d'appel (PDF)"
              description={`${reg.classroom.name}, ${formatDate(date)}, matin et après-midi`}
            />
            {staffAttendance && (
              <ButtonLink href={`/espace/presences/enseignants?date=${date}`} variant="secondary">
                <UserSquare2 aria-hidden /> Enseignants
              </ButtonLink>
            )}
          </>
        }
      />
      <RegisterFilters action="/espace/presences" classes={classes} classroomId={classroomId} date={date} half={half} maxDate={today} />

      <StatGrid>
        <StatCard label={`Présence de la classe, ${formatDate(date)}`} value={formatPercent(stats.classDayRate)} icon={CalendarCheck} hint="Matin et après-midi" />
        <StatCard label="Présence de la classe, semaine" value={formatPercent(stats.classWeekRate)} icon={CalendarDays} hint={`Du ${formatDate(stats.week.from)} au ${formatDate(stats.week.to)}`} />
        <StatCard label="Présence de l'établissement" value={formatPercent(stats.scopeDayRate)} icon={School} hint={formatDate(date)} />
        <StatCard label="Absences du jour" value={formatNumber(stats.absentToday)} icon={UserX} tone={stats.absentToday ? "danger" : "primary"} hint="Toutes classes de votre périmètre" />
      </StatGrid>

      <div className="mt-6 flex flex-col gap-3">
        {isWeekend(date) && <Alert tone="warning">Ce jour tombe un week-end. Vérifiez la date avant d&apos;enregistrer.</Alert>}
        {reg.recorded ? (
          <Alert tone="success">
            Appel déjà fait{reg.recorder ? ` par ${reg.recorder.firstName} ${reg.recorder.lastName}` : ""}. Vous pouvez le corriger puis enregistrer à nouveau.
          </Alert>
        ) : (
          editable && <Alert tone="info">Appel pas encore fait : tous les élèves sont présents par défaut. Signalez seulement les absents et les retards.</Alert>
        )}
      </div>

      <div className="mt-4 grid gap-6 2xl:grid-cols-[minmax(0,1fr)_20rem]">
        <AttendanceRegister
          rows={reg.rows.map((r) => ({ id: r.enrollmentId, name: r.name, detail: r.matricule, status: r.status, reason: r.reason }))}
          action={saveAttendance}
          payload={{ classroomId, date, half }}
          idKey="enrollmentId"
          editable={editable}
          caption={`Appel de la ${reg.classroom.name}`}
        />
        <Card className="self-start">
          <CardHeader>
            <div className="flex items-center gap-1.5">
              <CardTitle>Élèves les plus absents</CardTitle>
              <InfoTip>Demi-journées d&apos;absence depuis la rentrée, hors absences excusées.</InfoTip>
            </div>
          </CardHeader>
          <CardBody>
            {absentees.length ? (
              <BarChart
                label="Nombre de demi-journées d'absence depuis la rentrée"
                data={absentees.map((a) => ({
                  label: `${a.enrollment.student.lastName} ${a.enrollment.student.firstName} (${a.enrollment.classroom.name})`,
                  value: a.absences,
                  href: `/espace/eleves/${a.enrollment.student.id}`,
                  tone: "danger" as const,
                }))}
                format={(n) => `${n} demi-j.`}
              />
            ) : (
              <p className="text-sm text-muted">Aucune absence depuis la rentrée.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
