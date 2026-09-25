import { CalendarCheck } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/kit/states";
import { SectionTitle, SpokenSummary } from "@/features/family/components/blocks";
import { AttendanceFigures, AttendanceHistory } from "@/features/family/components/sections";
import { countWord, presenceRate, summariseAttendance } from "@/features/family/logic";
import { attendanceOf, requireStudentFile } from "@/features/family/queries";
import { formatPercent } from "@/lib/utils";

export const metadata: Metadata = { title: "Présences" };

const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export default async function AttendancePage({ params }: PageProps<"/espace/suivi/[studentId]/presences">) {
  const { studentId } = await params;
  const { enrollment } = await requireStudentFile(studentId);
  const records = await attendanceOf(enrollment);

  if (!records.length) {
    return (
      <EmptyState
        className="rounded-card border border-border bg-surface"
        icon={<CalendarCheck className="size-7" />}
        title="Pas encore d'appel enregistré"
        description="Les présences apparaissent ici dès que l'établissement fait l'appel en classe."
      />
    );
  }

  const summary = summariseAttendance(records);
  const rate = presenceRate(summary);
  const absences = records.filter((r) => r.status === "ABSENT");
  const last = absences[0];
  const text = [
    `Présences de ${enrollment.student.firstName} depuis la rentrée.`,
    `${countWord(summary.absences, "demi-journée d'absence", "demi-journées d'absence")}, ${countWord(summary.lates, "retard", "retards", "m").toLowerCase()}.`,
    rate !== null ? `Taux de présence : ${formatPercent(rate)}.` : "",
    last ? `Dernière absence : ${dayFmt.format(last.date)}, ${last.half === "MORNING" ? "le matin" : "l'après-midi"}${last.reason ? `, motif : ${last.reason}` : ""}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-5">
      <SpokenSummary text={text} label="Écouter les présences" />
      <AttendanceFigures absences={summary.absences} lates={summary.lates} excused={summary.excused} rate={rate} />
      <section aria-labelledby="history-title">
        <SectionTitle icon={CalendarCheck}>
          <span id="history-title">Historique jour par jour</span>
        </SectionTitle>
        <AttendanceHistory records={records} />
      </section>
    </div>
  );
}
