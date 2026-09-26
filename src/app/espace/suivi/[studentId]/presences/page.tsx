import { CalendarCheck } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/kit/states";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { SectionTitle, SpokenSummary } from "@/features/family/components/blocks";
import { AttendanceFigures, AttendanceHistory } from "@/features/family/components/sections";
import { countWord, presenceRate, summariseAttendance } from "@/features/family/logic";
import { attendanceOf, requireStudentSection } from "@/features/family/queries";
import { can } from "@/lib/auth/authorize";
import { formatPercent } from "@/lib/utils";

export const metadata: Metadata = { title: "Présences" };

const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export default async function AttendancePage({ params }: PageProps<"/espace/suivi/[studentId]/presences">) {
  const { studentId } = await params;
  const { user, enrollment } = await requireStudentSection(studentId, "presences");
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
      {absences.length > 0 && can(user, "family_document:create") && (
        <Alert
          tone="info"
          title={`${absences.length} demi-journée${absences.length > 1 ? "s" : ""} d'absence non justifiée${absences.length > 1 ? "s" : ""}`}
          action={
            <ButtonLink href={`/espace/pieces-justificatifs?enfant=${studentId}`} size="sm" variant="secondary">
              Justifier une absence
            </ButtonLink>
          }
        >
          Expliquez l&apos;absence en quelques mots, avec un justificatif si vous en avez un. L&apos;école vous répond.
        </Alert>
      )}
      <section aria-labelledby="history-title">
        <SectionTitle icon={CalendarCheck}>
          <span id="history-title">Historique jour par jour</span>
        </SectionTitle>
        <AttendanceHistory records={records} />
      </section>
    </div>
  );
}
