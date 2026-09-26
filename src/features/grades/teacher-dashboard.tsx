import { CheckCircle2, ClipboardCheck, FileText, LayoutGrid, NotebookPen, Users } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/kit/page-header";
import { StatCard, StatGrid } from "@/components/kit/stat-card";
import { EmptyState } from "@/components/kit/states";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveYear, getCurrentPeriod, userPeriodicity } from "@/features/classes/academic";
import { can } from "@/lib/auth/authorize";
import { classroomWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { isoToDate, isWeekend, todayIso } from "@/lib/domain/attendance";
import { sheetProgress } from "@/lib/domain/grade-entry";
import { db } from "@/lib/db";
import { formatDate, formatNumber, formatPercent } from "@/lib/utils";

// Dashboard for teachers. Owned by the pedagogy module: my classes, grade
// sheets to complete with their progress, attendance to take today.
export async function TeacherDashboard({ user }: { user: NonNullable<CurrentUser> }) {
  const [year, period] = await Promise.all([getActiveYear(), getCurrentPeriod(userPeriodicity(user))]);
  const header = <PageHeader title={`Bonjour, ${user.firstName}`} description={`${user.role.name} · ${user.scope.label}${period ? ` · ${period.name} ${year?.label ?? ""}` : ""}`} />;
  if (!user.teacherId || !year || !period) {
    return (
      <>
        {header}
        <EmptyState title="Aucun enseignement attribué" description="Votre compte n'est lié à aucune fiche enseignant de l'année active. Contactez la direction." />
      </>
    );
  }

  const today = todayIso();
  const [assignments, classes] = await Promise.all([
    db.courseAssignment.findMany({
      where: { teacherId: user.teacherId, classroom: { academicYearId: year.id } },
      orderBy: [{ classroom: { level: { order: "asc" } } }, { classroom: { name: "asc" } }],
      select: {
        id: true,
        subject: { select: { name: true } },
        classroom: { select: { id: true, name: true, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } } },
        gradeSheets: {
          where: { periodId: period.id },
          select: {
            id: true,
            isLocked: true,
            interrogationCount: true,
            devoirCount: true,
            compositionCount: true,
            _count: { select: { grades: { where: { enrollment: { status: "ACTIVE" } } } } },
          },
        },
      },
    }),
    db.classroom.findMany({
      where: { AND: [classroomWhere(user), { academicYearId: year.id }] },
      orderBy: [{ level: { order: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, mainTeacherId: true, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
    }),
  ]);

  // Per class and half day: has the register been taken today?
  const perClass = await db.studentAttendance.groupBy({
    by: ["half", "enrollmentId"],
    where: { date: isoToDate(today), enrollment: { status: "ACTIVE", classroomId: { in: classes.map((c) => c.id) } } },
    _count: { _all: true },
  });
  const enrollmentClass = new Map(
    (await db.enrollment.findMany({ where: { id: { in: [...new Set(perClass.map((p) => p.enrollmentId))] } }, select: { id: true, classroomId: true } })).map((e) => [e.id, e.classroomId]),
  );
  const taken = new Set(perClass.map((p) => `${enrollmentClass.get(p.enrollmentId)}:${p.half}`));
  const mainClasses = classes.filter((c) => c.mainTeacherId === user.teacherId);
  const registerClasses = mainClasses.length ? mainClasses : classes;
  const toTake = isWeekend(today) ? 0 : registerClasses.reduce((n, c) => n + (taken.has(`${c.id}:MORNING`) ? 0 : 1) + (taken.has(`${c.id}:AFTERNOON`) ? 0 : 1), 0);

  const sheets = assignments.map((a) => {
    const s = a.gradeSheets[0];
    const evaluations = s ? s.interrogationCount + s.devoirCount + s.compositionCount : 0;
    return { a, sheet: s ?? null, progress: s ? sheetProgress(s._count.grades, a.classroom._count.enrollments, evaluations) : 0 };
  });
  const toComplete = sheets.filter((s) => !s.sheet || (!s.sheet.isLocked && s.progress < 1));
  const studentCount = new Map(assignments.map((a) => [a.classroom.id, a.classroom._count.enrollments]));

  return (
    <>
      {header}
      <StatGrid>
        <StatCard label="Mes classes" value={formatNumber(classes.length)} icon={LayoutGrid} href="/espace/classes" />
        <StatCard label="Élèves suivis" value={formatNumber([...studentCount.values()].reduce((a, b) => a + b, 0))} icon={Users} tone="info" />
        <StatCard label="Fiches à compléter" value={formatNumber(toComplete.length)} hint={period.name} icon={NotebookPen} tone="accent" href="/espace/notes" />
        <StatCard label="Appels à faire aujourd'hui" value={formatNumber(toTake)} hint={formatDate(today)} icon={ClipboardCheck} tone={toTake ? "danger" : "primary"} href="/espace/presences" />
      </StatGrid>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Fiches de notes, {period.name}</CardTitle>
            {can(user, "grade:view") && (
              <Link href="/espace/notes" className="text-sm font-semibold text-primary hover:underline">
                Toutes mes fiches
              </Link>
            )}
          </CardHeader>
          {sheets.length === 0 ? (
            <EmptyState title="Aucune matière attribuée" />
          ) : (
            <ul className="divide-y divide-border">
              {sheets.map(({ a, sheet, progress }) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {a.classroom.name} · {a.subject.name}
                    </p>
                    {sheet ? (
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-2 min-w-0 flex-1 basis-24 rounded-full bg-surface-2 sm:max-w-40" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Saisie ${a.classroom.name}, ${a.subject.name}`}>
                          <div className={progress >= 1 ? "h-full rounded-full bg-success" : "h-full rounded-full bg-primary"} style={{ width: `${Math.round(progress * 100)}%` }} />
                        </div>
                        <span className="shrink-0 text-xs font-semibold whitespace-nowrap tabular-nums">{formatPercent(progress)}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted">Pas encore de fiche pour cette période</p>
                    )}
                  </div>
                  {sheet?.isLocked ? (
                    <Badge>Verrouillée</Badge>
                  ) : sheet && progress >= 1 ? (
                    <Badge tone="success">
                      <CheckCircle2 aria-hidden /> Complète
                    </Badge>
                  ) : null}
                  {sheet ? (
                    <ButtonLink href={`/espace/notes/${sheet.id}`} size="sm" variant={sheet.isLocked ? "secondary" : "primary"} aria-label={`${sheet.isLocked ? "Consulter" : "Saisir"} les notes de ${a.subject.name}, ${a.classroom.name}`}>
                      {sheet.isLocked ? "Consulter" : "Saisir"}
                    </ButtonLink>
                  ) : (
                    can(user, "grade:create") && (
                      <ButtonLink href="/espace/notes" size="sm" variant="secondary">
                        Créer la fiche
                      </ButtonLink>
                    )
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Appel du jour</CardTitle>
            </CardHeader>
            {isWeekend(today) ? (
              <EmptyState title="Pas d'appel le week-end" />
            ) : (
              <ul className="divide-y divide-border">
                {registerClasses.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                    <span className="font-semibold">
                      {c.name}
                      {c.mainTeacherId === user.teacherId && <span className="ml-2 text-xs font-normal text-muted">prof. principal</span>}
                    </span>
                    <span className="flex gap-2">
                      {(["MORNING", "AFTERNOON"] as const).map((half) => {
                        const done = taken.has(`${c.id}:${half}`);
                        const label = half === "MORNING" ? "Matin" : "Après-midi";
                        return (
                          <Link
                            key={half}
                            href={`/espace/presences?classe=${c.id}&date=${today}&demi=${half}`}
                            className={
                              done
                                ? "inline-flex h-9 items-center gap-1 rounded-lg border border-success bg-success-soft px-3 font-semibold text-success"
                                : "inline-flex h-9 items-center gap-1 rounded-lg border border-border-strong px-3 font-semibold hover:bg-surface-2"
                            }
                            aria-label={`${c.name}, ${label} : ${done ? "appel fait" : "faire l'appel"}`}
                          >
                            {done && <CheckCircle2 className="size-4" aria-hidden />}
                            {label}
                            <span className="sr-only">{done ? ", fait" : ", à faire"}</span>
                          </Link>
                        );
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Accès rapides</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 gap-2 p-4">
              <ButtonLink href="/espace/notes" variant="secondary">
                <NotebookPen aria-hidden /> Notes
              </ButtonLink>
              <ButtonLink href="/espace/presences" variant="secondary">
                <ClipboardCheck aria-hidden /> Présences
              </ButtonLink>
              <ButtonLink href="/espace/classes" variant="secondary">
                <LayoutGrid aria-hidden /> Mes classes
              </ButtonLink>
              <ButtonLink href="/espace/eleves" variant="secondary">
                <FileText aria-hidden /> Mes élèves
              </ButtonLink>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
