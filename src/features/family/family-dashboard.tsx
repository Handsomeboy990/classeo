import { BookOpen, CalendarCheck, CalendarDays, Clock, FileText, MessageCircle, NotebookPen, PlayCircle, Users } from "lucide-react";
import Link from "next/link";

import { AverageLevel } from "@/components/kit/level";
import { PageHeader } from "@/components/kit/page-header";
import { ReadAloud } from "@/components/kit/read-aloud";
import { EmptyState } from "@/components/kit/states";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { StudentAvatar } from "@/features/students/components/student-avatar";
import { GuardianTransferRequests } from "@/features/transfers/components/guardian-requests";
import type { CurrentUser } from "@/lib/auth/session";
import { cn, formatAverage, formatDate } from "@/lib/utils";

import { DateLeaf, formatEventDate, PictoTile, SectionTitle, SpokenSummary } from "./components/blocks";
import { beninToday, countWord, spokenTime } from "./logic";
import { childOverview, type ChildOverview } from "./overview";
import { classResources, followedEnrollments, unreadMessageCount, upcomingEvents } from "./queries";

type User = NonNullable<CurrentUser>;

// Dashboard for parents and students: one spoken summary per child, big
// pictogram cards, the day's classes and the school's next events.
export async function FamilyDashboard({ user }: { user: User }) {
  const today = beninToday();
  const isParent = !!user.guardianId;
  const enrollments = await followedEnrollments(user);

  if (!enrollments.length) {
    return (
      <>
        <PageHeader title={`Bonjour, ${user.firstName}`} description={user.role.name} />
        <EmptyState
          icon={<Users className="size-7" />}
          title={isParent ? "Aucun enfant n'est encore rattaché à votre compte" : "Vous n'êtes pas encore inscrit pour cette année"}
          description={
            isParent
              ? "Le secrétariat de l'école rattache chaque enfant au numéro de téléphone de ses parents. Il s'affichera ici dès que ce sera fait."
              : "Votre inscription 2026-2027 n'est pas encore enregistrée. Rapprochez-vous du secrétariat de votre établissement."
          }
        />
      </>
    );
  }

  const [overviews, unread, events, resources] = await Promise.all([
    Promise.all(enrollments.map((e) => childOverview(user, e, today))),
    unreadMessageCount(user),
    upcomingEvents(user, enrollments, today),
    isParent ? Promise.resolve([]) : classResources(user, enrollments[0]!),
  ]);

  const next = events[0];
  const household = [
    `Bonjour ${user.firstName}.`,
    unread ? `Vous avez ${countWord(unread, "message non lu", "messages non lus", "m").toLowerCase()}.` : "Aucun nouveau message.",
    next?.eventDate ? `Prochain événement : ${next.title}, ${formatEventDate(next.eventDate).toLowerCase()}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <PageHeader
        title={`Bonjour, ${user.firstName}`}
        description={isParent ? "Bulletins, présences et cours de vos enfants. « Écouter » lit ce résumé à voix haute." : "Vos cours, vos notes et vos présences. « Écouter » lit ce résumé à voix haute."}
        readable={false}
      />
      <GuardianTransferRequests user={user} />

      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-[1fr_20rem]">
        <SpokenSummary text={household} label="Écouter" />
        <PictoTile icon={MessageCircle} tone={unread ? "danger" : "primary"} title="Messages" href="/espace/messages" layout="row">
          <p className="font-display text-lg font-bold lg:text-2xl">{unread ? `${unread} non lu${unread > 1 ? "s" : ""}` : "À jour"}</p>
        </PictoTile>
      </div>

      <div className="mt-6 flex flex-col gap-6 sm:mt-8 sm:gap-8">
        {overviews.map((o) => (
          <ChildPanel key={o.enrollment.id} overview={o} isParent={isParent} />
        ))}
      </div>

      {!isParent && overviews[0] && (
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <TermGrades overview={overviews[0]} />
          <TodayTimeline overview={overviews[0]} />
        </div>
      )}

      {!isParent && (
        <section className="mt-8" aria-labelledby="resources-title">
          <SectionTitle icon={BookOpen}>
            <span id="resources-title">Ressources de ma classe</span>
          </SectionTitle>
          {resources.length ? (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {resources.map((r) => (
                <li key={r.id} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {r.subjectLabel && <Badge tone="info">{r.subjectLabel}</Badge>}
                    {r.mediaType === "VIDEO" || r.mediaType === "AUDIO" ? (
                      <Badge tone="neutral">
                        <PlayCircle aria-hidden /> {r.mediaType === "VIDEO" ? "Vidéo" : "Audio"}, transcription incluse
                      </Badge>
                    ) : null}
                  </div>
                  <h3 className="font-sans text-base font-bold">{r.title}</h3>
                  {r.easyRead && <p className="text-sm text-muted">{r.easyRead}</p>}
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                    <ReadAloud text={[r.title, r.easyRead, r.transcript].filter(Boolean).join(". ")} label="Écouter" />
                    <Link href="/espace/contenus" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
                      Ouvrir
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState className="rounded-card border border-border bg-surface" icon={<BookOpen className="size-7" />} title="Aucune ressource pour le moment" description="Les fiches, vidéos et exercices publiés par vos enseignants s'afficheront ici." />
          )}
        </section>
      )}

      <section className="mt-8" aria-labelledby="events-title">
        <SectionTitle icon={CalendarDays}>
          <span id="events-title">Prochains événements</span>
        </SectionTitle>
        {events.length ? (
          <ul className="flex flex-col gap-3">
            {events.map((e) => (
              <li key={e.id} className="flex gap-4 rounded-card border border-border bg-surface p-4">
                {e.eventDate && <DateLeaf date={e.eventDate} />}
                <div className="min-w-0 flex-1">
                  <h3 className="font-sans text-base font-bold">{e.title}</h3>
                  {e.eventDate && <p className="text-sm font-semibold text-primary">{formatEventDate(e.eventDate)}</p>}
                  <p className="mt-1 text-sm text-muted">{e.easyRead ?? e.body}</p>
                  {e.school && <p className="mt-1 text-xs text-muted">{e.school.name}</p>}
                </div>
                <ReadAloud compact text={[e.title, e.eventDate ? formatEventDate(e.eventDate) : "", e.easyRead ?? e.body].filter(Boolean).join(". ")} label={`Écouter : ${e.title}`} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState className="rounded-card border border-border bg-surface" icon={<CalendarDays className="size-7" />} title="Aucun événement prévu" description="Les réunions, sorties et fêtes de l'école s'afficheront ici." />
        )}
      </section>
    </>
  );
}

function ChildPanel({ overview: o, isParent }: { overview: ChildOverview; isParent: boolean }) {
  const e = o.enrollment;
  const base = `/espace/suivi/${e.student.id}`;
  const name = `${e.student.firstName} ${e.student.lastName}`;
  const headingId = `child-${e.student.id}`;
  const gradeCount = o.term.subjects.reduce((n, s) => n + s.grades.length, 0);

  return (
    <section aria-labelledby={headingId} className="overflow-hidden rounded-card border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-2 p-4 sm:gap-4 sm:p-5">
        <StudentAvatar name={name} photoFileId={e.student.photoFileId} className="size-12 text-base sm:size-14 sm:text-lg" />
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="text-xl font-bold sm:text-2xl">
            {isParent ? name : "Ma journée"}
          </h2>
          <p className="text-muted">
            {e.classroom.name} · {e.school.name}
          </p>
        </div>
        <ButtonLink href={base} variant="secondary" className="max-sm:w-full">
          {isParent ? "Suivi complet" : "Ma scolarité"}
        </ButtonLink>
      </div>
      <div className="p-4 sm:p-5">
        <SpokenSummary text={o.summary} />
        {/* Two by two from the smallest phone: results first, then the week
            and the day. */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 2xl:grid-cols-4">
          <PictoTile icon={FileText} title="Dernier bulletin" href={base} footer={o.lastReport?.periodLabel}>
            {o.lastReport ? <AverageLevel average={o.lastReport.average} /> : <p className="text-sm text-muted">Pas encore de bulletin publié.</p>}
          </PictoTile>
          <PictoTile icon={NotebookPen} tone="accent" title="Notes du trimestre" href={`${base}/notes`} footer={o.term.period ? `${o.term.period.name} · ${countWord(gradeCount, "note", "notes").toLowerCase()}` : undefined}>
            {o.term.average !== null ? <AverageLevel average={o.term.average} /> : <p className="text-sm text-muted">Pas encore de note ce trimestre.</p>}
          </PictoTile>
          <PictoTile
            icon={CalendarCheck}
            tone={o.weekSummary.absences ? "danger" : "success"}
            title="Cette semaine"
            href={`${base}/presences`}
            footer={o.weekSummary.lates ? countWord(o.weekSummary.lates, "arrivée en retard", "arrivées en retard") : o.weekSummary.recorded ? "Aucun retard" : undefined}
          >
            <p className="font-display text-lg font-bold sm:text-2xl">{o.weekSummary.recorded ? countWord(o.weekSummary.absences, "absence", "absences") : "Pas encore d'appel"}</p>
          </PictoTile>
          <PictoTile icon={Clock} tone="info" title="Aujourd'hui" href={`${base}/emploi-du-temps`}>
            {!o.hasTimetable ? (
              <p className="text-sm text-muted">Emploi du temps pas encore publié par l&apos;école.</p>
            ) : o.todaySlots.length ? (
              // Half a phone width: two courses, the time above the subject;
              // three on one line each from 40rem.
              <ul className="flex flex-col gap-1.5 text-sm sm:gap-1 sm:text-base">
                {o.todaySlots.slice(0, 3).map((s, i) => (
                  <li key={s.id} className={cn("flex flex-col sm:flex-row sm:gap-2", i === 2 && "max-sm:hidden")}>
                    <span className="shrink-0 font-semibold tabular-nums sm:w-16">{spokenTime(s.startTime)}</span>
                    <span className="min-w-0 truncate max-sm:text-muted">{s.subject}</span>
                  </li>
                ))}
                {o.todaySlots.length > 2 && (
                  <li className={cn("text-xs text-muted sm:text-sm", o.todaySlots.length === 3 && "sm:hidden")}>
                    <span className="sm:hidden">
                      et {o.todaySlots.length - 2} autre{o.todaySlots.length > 3 ? "s" : ""}
                    </span>
                    {o.todaySlots.length > 3 && (
                      <span className="max-sm:hidden">
                        et {o.todaySlots.length - 3} autre{o.todaySlots.length > 4 ? "s" : ""}
                      </span>
                    )}
                  </li>
                )}
              </ul>
            ) : (
              <p className="font-display text-lg font-bold sm:text-2xl">Pas de cours</p>
            )}
          </PictoTile>
        </div>
      </div>
    </section>
  );
}

function TermGrades({ overview: o }: { overview: ChildOverview }) {
  const withGrades = o.term.subjects.filter((s) => s.average !== null);
  return (
    <section aria-labelledby="my-grades-title">
      <SectionTitle icon={NotebookPen} action={<ButtonLink href={`/espace/suivi/${o.enrollment.student.id}/notes`} variant="ghost" size="sm">Tout voir</ButtonLink>}>
        <span id="my-grades-title">Mes notes ce trimestre</span>
      </SectionTitle>
      {withGrades.length ? (
        <ul className="divide-y divide-border rounded-card border border-border bg-surface [&_.rounded-full]:flex-wrap">
          {withGrades.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <span className="font-semibold">{s.subject}</span>
              <AverageLevel average={s.average} />
            </li>
          ))}
          <li className="flex flex-wrap items-center justify-between gap-2 bg-surface-2 px-4 py-3">
            <span className="font-bold">Moyenne générale provisoire</span>
            <span className="sr-only">{formatAverage(o.term.average)} sur 20</span>
            <AverageLevel average={o.term.average} />
          </li>
        </ul>
      ) : (
        <EmptyState className="rounded-card border border-border bg-surface" icon={<NotebookPen className="size-7" />} title="Pas encore de note" description="Vos notes apparaîtront dès que vos enseignants les auront saisies." />
      )}
    </section>
  );
}

function TodayTimeline({ overview: o }: { overview: ChildOverview }) {
  return (
    <section aria-labelledby="my-day-title">
      <SectionTitle icon={Clock} action={<ButtonLink href={`/espace/suivi/${o.enrollment.student.id}/emploi-du-temps`} variant="ghost" size="sm">Semaine</ButtonLink>}>
        <span id="my-day-title">Mon emploi du temps aujourd&apos;hui</span>
      </SectionTitle>
      {o.todaySlots.length ? (
        <ol className="relative flex flex-col gap-3 border-l-2 border-primary/40 pl-5">
          {o.todaySlots.map((s) => (
            <li key={s.id} className="relative rounded-card border border-border bg-surface p-3">
              <span className="absolute top-4 -left-[1.72rem] size-3 rounded-full border-2 border-surface bg-primary" aria-hidden />
              <p className="text-sm font-semibold text-primary tabular-nums">
                {spokenTime(s.startTime)} à {spokenTime(s.endTime)}
              </p>
              <p className="font-bold">{s.subject}</p>
              <p className="text-sm text-muted">{[s.room, s.teacher].filter(Boolean).join(" · ")}</p>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          className="rounded-card border border-border bg-surface"
          icon={<Clock className="size-7" />}
          title={o.hasTimetable ? "Pas de cours aujourd'hui" : "Emploi du temps pas encore publié"}
          description={o.hasTimetable ? `Aucun cours prévu le ${formatDate(new Date())}.` : "Votre établissement ne l'a pas encore mis en ligne."}
        />
      )}
    </section>
  );
}
