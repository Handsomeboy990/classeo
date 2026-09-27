import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReadAloud } from "@/components/kit/read-aloud";
import { EmptyState } from "@/components/kit/states";
import { Alert } from "@/components/ui/alert";
import { PrintButton } from "@/components/kit/print-button";
import { printableCard } from "@/features/report-cards/queries";
import { can, requirePermission } from "@/lib/auth/authorize";
import { spokenSummary } from "@/lib/domain/report-card";
import { schoolIssuer } from "@/lib/pdf/data/common";
import { PdfDownloadLink } from "@/lib/pdf/download-link";
import { documentReference } from "@/lib/pdf/format";
import { headOfClassroomSchool } from "@/lib/pdf/data/report-cards";
import { PrintReportCard } from "@/lib/pdf/print/report-card";

export const metadata: Metadata = { title: "Bulletin" };

export default async function ReportCardPage(props: PageProps<"/espace/bulletins/[enrollmentId]/[periodId]">) {
  const user = await requirePermission("report_card:view");
  const { enrollmentId, periodId } = await props.params;
  const data = await printableCard(user, enrollmentId, periodId);
  if (!data) notFound();
  const { enrollment, period, mode, card } = data;
  const s = enrollment.student;
  const c = enrollment.classroom;
  const name = `${s.lastName} ${s.firstName}`;
  const back = can(user, "report_card:publish") || can(user, "report_card:export") ? `/espace/bulletins?classe=${enrollment.classroomId}&periode=${period.id}` : `/espace/eleves/${s.id}`;

  if (!card) {
    return (
      <EmptyState
        title="Bulletin pas encore publié"
        description={`Le bulletin du ${period.name} de ${name} sera disponible dès sa publication par l'établissement.`}
        action={
          <Link href={back} className="font-semibold text-primary hover:underline">
            Retour
          </Link>
        }
      />
    );
  }

  const summary = spokenSummary({ name: `${s.firstName} ${s.lastName}`, ...card }, period.name);

  const mt = c.mainTeacher ? `${c.mainTeacher.firstName} ${c.mainTeacher.lastName}` : null;
  const now = new Date();
  const meta = {
    title: "Bulletin de notes",
    subtitle: `${period.name} · ${enrollment.academicYear.label}`,
    reference: documentReference("BUL", now, enrollment.id, period.id, mode),
    generatedAt: now,
    generatedBy: { name: user.fullName, role: user.role.name, email: user.username },
    issuer: schoolIssuer(c.school),
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3" data-print-hide>
        {/* Below lg the app bar has the back button. */}
        <Link href={back} className="-ml-1 inline-flex min-h-11 items-center gap-1 px-1 text-[0.8125rem] font-semibold text-muted underline-offset-3 hover:text-text hover:underline max-lg:hidden">
          <ChevronLeft className="size-4 shrink-0" aria-hidden />
          Retour
        </Link>
        <div className="flex flex-wrap gap-2">
          <ReadAloud text={summary} label="Écouter le bulletin" />
          <PrintButton />
          <PdfDownloadLink href={`/api/pdf/bulletin?inscription=${enrollment.id}&periode=${period.id}`} description={`bulletin de ${name}, ${period.name}`} />
        </div>
      </div>
      {mode === "preview" && (
        <div data-print-hide>
          <Alert tone="warning" className="mb-4" title="Aperçu non publié">
            Ce bulletin est calculé à partir des notes actuelles. Les familles ne le verront qu&apos;après publication.
          </Alert>
        </div>
      )}

      <PrintReportCard
        meta={meta}
        footnote={`Résumé lu à voix haute : ${summary}`}
        data={{
          enrollmentId: enrollment.id,
          mode: mode === "preview" ? "preview" : "published",
          student: s,
          classroom: { name: c.name, mainTeacher: mt },
          headOfSchool: await headOfClassroomSchool(enrollment.classroomId),
          isRepeating: enrollment.isRepeating,
          yearLabel: enrollment.academicYear.label,
          periodName: period.name,
          card,
        }}
      />
    </>
  );
}
