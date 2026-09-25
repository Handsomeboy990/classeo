import { Baby, CalendarCheck, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, redirect } from "next/navigation";

import { AverageLevel } from "@/components/kit/level";
import { PageHeader } from "@/components/kit/page-header";
import { EmptyState } from "@/components/kit/states";
import { SpokenSummary } from "@/features/family/components/blocks";
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
      <PageHeader title="Mes enfants" description="Choisissez un enfant pour ouvrir son suivi complet." readable={false} />
      <GuardianTransferRequests user={user} />
      <SpokenSummary text={intro} label="Écouter" className="mb-6" />
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
                  className="flex h-full flex-col gap-4 rounded-card border border-border bg-surface p-5 transition-colors hover:border-primary hover:bg-surface-2"
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <StudentAvatar name={name} photoFileId={e.student.photoFileId} className="size-16 text-xl" />
                    <div className="min-w-0 break-words hyphens-auto">
                      <h2 className="text-2xl font-bold">{name}</h2>
                      <p className="text-muted">
                        {e.classroom.name} · {e.school.name}
                      </p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
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
                  <span className="mt-auto text-sm font-semibold text-primary">Ouvrir le suivi de {e.student.firstName}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
