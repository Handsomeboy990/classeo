import { Baby, CalendarCheck, ChevronRight, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, redirect } from "next/navigation";

import { AverageLevel } from "@/components/kit/level";
import { PageHeader } from "@/components/kit/page-header";
import { EmptyState } from "@/components/kit/states";
import { beninToday, countWord } from "@/features/family/logic";
import { childOverview } from "@/features/family/overview";
import { followedEnrollments } from "@/features/family/queries";
import { requireUser } from "@/lib/auth/session";
import { StudentAvatar } from "@/features/students/components/student-avatar";
import { GuardianTransferRequests } from "@/features/transfers/components/guardian-requests";

export const metadata: Metadata = { title: "Mes enfants" };

// Parent: the children they follow. Student: straight to their own file.
export default async function FollowUpPage() {
  const user = await requireUser();
  if (user.scope.level !== "SELF") forbidden();
  if (!user.guardianId) {
    if (user.studentId) redirect(`/espace/suivi/${user.studentId}`);
    forbidden();
  }

  const today = beninToday();
  const enrollments = await followedEnrollments(user);
  const overviews = await Promise.all(enrollments.map((e) => childOverview(user, e, today)));
  const intro =
    overviews.length === 0
      ? "Aucun enfant n'est rattaché à votre compte."
      : `Vous suivez ${overviews.length === 1 ? "un enfant" : `${overviews.length} enfants`} : ${overviews.map((o) => o.enrollment.student.firstName).join(" et ")}. Choisissez un enfant pour voir ses bulletins, ses notes, ses présences et son emploi du temps.`;

  return (
    <>
      <PageHeader title="Mes enfants" info="Choisissez un enfant pour ouvrir son suivi complet : bulletins, notes, présences et emploi du temps." listen={{ text: intro, label: "Écouter" }} />
      <GuardianTransferRequests user={user} />
      {overviews.length === 0 ? (
        <EmptyState
          className="rounded-card border border-border bg-surface"
          icon={<Baby className="size-7" />}
          title="Aucun enfant rattaché"
          description="Demandez au secrétariat de l'école de rattacher votre enfant à votre compte."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {overviews.map((o) => {
            const e = o.enrollment;
            const name = `${e.student.firstName} ${e.student.lastName}`;
            return (
              <li key={e.id}>
                <Link
                  href={`/espace/suivi/${e.student.id}`}
                  className="flex h-full flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-card transition-[border-color,box-shadow] duration-150 hover:border-primary/40 hover:shadow-[var(--elevation-sm)] lg:p-6"
                >
                  <div className="flex items-center gap-4">
                    <StudentAvatar name={name} photoFileId={e.student.photoFileId} className="size-14 text-lg" />
                    <div className="min-w-0 break-words hyphens-auto">
                      <h2 className="text-xl font-bold text-text">{name}</h2>
                      <p className="text-sm text-muted">
                        {e.classroom.name} · {e.school.name}
                      </p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-1 gap-3 border-t border-border pt-4 min-[420px]:grid-cols-2">
                    <div className="flex items-start gap-2">
                      <FileText className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
                      <div>
                        <dt className="text-sm text-muted">Dernier bulletin</dt>
                        <dd className="mt-1 [&_.rounded-full]:flex-wrap">{o.lastReport ? <AverageLevel average={o.lastReport.average} /> : "Pas encore publié"}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CalendarCheck className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
                      <div>
                        <dt className="text-sm text-muted">Cette semaine</dt>
                        <dd className="mt-1 font-semibold">{countWord(o.weekSummary.absences, "absence", "absences")}</dd>
                      </div>
                    </div>
                  </dl>
                  <span className="mt-auto inline-flex items-center gap-1 font-display text-sm font-semibold text-link">
                    Ouvrir le suivi de {e.student.firstName}
                    <ChevronRight className="size-4 shrink-0" aria-hidden />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
