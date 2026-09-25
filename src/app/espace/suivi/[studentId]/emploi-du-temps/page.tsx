import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/kit/states";
import { SpokenSummary } from "@/features/family/components/blocks";
import { TimetableWeek } from "@/features/family/components/sections";
import { beninToday, DAYS, spokenTime } from "@/features/family/logic";
import { requireStudentFile, timetableOf } from "@/features/family/queries";

export const metadata: Metadata = { title: "Emploi du temps" };

export default async function TimetablePage({ params }: PageProps<"/espace/suivi/[studentId]/emploi-du-temps">) {
  const { studentId } = await params;
  const { enrollment } = await requireStudentFile(studentId);
  const slots = await timetableOf(enrollment);
  const today = beninToday();

  if (!slots.length) {
    return (
      <EmptyState
        className="rounded-card border border-border bg-surface"
        icon={<CalendarDays className="size-7" />}
        title="Emploi du temps pas encore publié"
        description={`${enrollment.school.name} n'a pas encore mis en ligne l'emploi du temps de la classe ${enrollment.classroom.name}.`}
      />
    );
  }

  const todays = slots.filter((s) => s.dayOfWeek === today.dayOfWeek);
  const text = [
    `Emploi du temps de la classe ${enrollment.classroom.name}.`,
    todays.length
      ? `Aujourd'hui, ${DAYS[today.dayOfWeek - 1]!.toLowerCase()} : ${todays.map((s) => `${s.subject} de ${spokenTime(s.startTime)} à ${spokenTime(s.endTime)}`).join(", puis ")}.`
      : "Pas de cours aujourd'hui.",
  ].join(" ");

  return (
    <div className="flex flex-col gap-5">
      <SpokenSummary text={text} label="Écouter la journée" />
      <TimetableWeek slots={slots} today={today} />
    </div>
  );
}
