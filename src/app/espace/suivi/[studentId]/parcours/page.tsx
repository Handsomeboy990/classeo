import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SpokenSummary } from "@/features/family/components/blocks";
import { requireStudentFile } from "@/features/family/queries";
import { HistoryView } from "@/features/student-history/components/history-view";
import { studentHistory } from "@/features/student-history/queries";
import { can } from "@/lib/auth/authorize";

export const metadata: Metadata = { title: "Parcours" };

// Every school year of the child, every school, with the report cards and
// the attendance of each stay.
export default async function FamilyHistoryPage({ params }: PageProps<"/espace/suivi/[studentId]/parcours">) {
  const { studentId } = await params;
  const { user, enrollment } = await requireStudentFile(studentId);
  const history = await studentHistory(user, enrollment.student.id);
  if (!history) notFound();
  const stays = history.years.flatMap((y) => y.segments);
  const schools = [...new Set(stays.map((s) => s.school))];
  const summary = `${enrollment.student.firstName} a ${history.years.length === 1 ? "une année" : `${history.years.length} années`} de scolarité dans Classéo, ${schools.length === 1 ? `à ${schools[0]}` : `dans ${schools.length} établissements : ${schools.join(", ")}`}.${history.transfers.length ? ` ${history.transfers.length === 1 ? "Un transfert" : `${history.transfers.length} transferts`} dans son parcours.` : ""}`;
  return (
    <div className="flex flex-col gap-5">
      <SpokenSummary text={summary} label="Écouter le parcours" />
      <HistoryView
        history={history}
        transferHref={(tid) => `/espace/transferts/${tid}`}
        reportCardHref={(c) => (can(user, "report_card:view") ? `/espace/suivi/${enrollment.student.id}?b=${c.id}` : null)}
      />
    </div>
  );
}
