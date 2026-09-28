import { FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { roleLabel } from "@/features/messages/role-label";
import { EmptyState } from "@/components/kit/states";
import { Badge } from "@/components/ui/badge";
import { SpokenSummary } from "@/features/family/components/blocks";
import { PrintButton } from "@/components/kit/print-button";
import { ReportCardSheet } from "@/features/family/components/sections";
import { reportSentence } from "@/features/family/logic";
import { reportCardsOf, requireStudentSection } from "@/features/family/queries";
import { can } from "@/lib/auth/authorize";
import { param } from "@/lib/list";
import { loadReportCard } from "@/lib/pdf/data/report-cards";
import { PdfDownloadLink } from "@/lib/pdf/download-link";
import { COUNCIL_DECISION_LABELS, COUNCIL_DECISION_TONES } from "@/lib/domain/council";
import { ofThePeriod } from "@/lib/domain/periodicity";
import { documentReference } from "@/lib/pdf/format";
import { PrintReportCard } from "@/lib/pdf/print/report-card";

export const metadata: Metadata = { title: "Bulletins" };

// Published report cards: the snapshot the school published, never
// recomputed. One card at a time, printable.
export default async function ReportCardsPage({ params, searchParams }: PageProps<"/espace/suivi/[studentId]">) {
  const { studentId } = await params;
  const { user, enrollment } = await requireStudentSection(studentId, "bulletins");
  const cards = await reportCardsOf(user, studentId);
  const wanted = param(await searchParams, "b");
  const card = cards.find((c) => c.id === wanted) ?? cards[0];
  const student = { name: `${enrollment.student.firstName} ${enrollment.student.lastName}`, matricule: enrollment.student.matricule, photoFileId: enrollment.student.photoFileId };

  // The certificate of enrollment of the year, for accounts that may see
  // the student record (parents; the route checks it again).
  const attestation =
    can(user, "student:view") && enrollment.status === "ACTIVE" ? (
      <PdfDownloadLink href={`/api/pdf/attestation/${enrollment.student.id}`} label="Attestation de scolarité (PDF)" description={`année ${enrollment.academicYear.label}`} />
    ) : null;

  if (!card) {
    return (
      <EmptyState
        className="rounded-card border border-border bg-surface"
        icon={<FileText className="size-7" />}
        title="Aucun bulletin publié pour le moment"
        description={`Le bulletin apparaîtra ici dès que l'établissement l'aura publié, à la fin ${ofThePeriod(enrollment.school.periodicity)}. Vous recevrez une notification.`}
        action={attestation ?? undefined}
      />
    );
  }

  const printable = await loadReportCard(user, { reportCardId: card.id });
  const now = new Date();
  const printMeta = {
    title: "Bulletin de notes",
    subtitle: `${card.periodName} · ${card.yearLabel}`,
    reference: documentReference("BUL", now, printable?.data.enrollmentId, printable?.periodId, "published"),
    generatedAt: now,
    generatedBy: { name: user.fullName, role: roleLabel(user.role.name, user.gender), email: user.username },
  };

  const byYear = new Map<string, typeof cards>();
  for (const c of cards) byYear.set(c.yearLabel, [...(byYear.get(c.yearLabel) ?? []), c]);

  return (
    <div className="flex flex-col gap-5">
      <div data-print-hide>
        <SpokenSummary
          label="Écouter le bulletin"
          text={reportSentence({ firstName: enrollment.student.firstName, periodLabel: card.periodLabel, average: card.average, rank: card.rank, classSize: card.classSize, appreciation: card.appreciation })}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between" data-print-hide>
        <nav aria-label="Choisir un bulletin" className="flex flex-col gap-4">
          {[...byYear.entries()].map(([year, list]) => (
            <div key={year} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-display text-[0.6875rem] font-bold tracking-[0.08em] text-muted uppercase">{year}</span>
                {list[0]?.decision && (
                  <Badge tone={COUNCIL_DECISION_TONES[list[0].decision.decision]} title={list[0].decision.note ?? undefined} className="whitespace-normal">
                    Conseil de classe : {COUNCIL_DECISION_LABELS[list[0].decision.decision].toLowerCase()}
                  </Badge>
                )}
              </span>
              <span className="ds-segmented self-start">
                {[...list].reverse().map((c) => (
                  <Link key={c.id} href={`/espace/suivi/${studentId}?b=${c.id}`} aria-current={c.id === card.id ? "page" : undefined} scroll={false}>
                    {c.periodName}
                  </Link>
                ))}
              </span>
            </div>
          ))}
        </nav>
        <div className="flex flex-wrap gap-2">
          <PrintButton label="Imprimer le bulletin" />
          <PdfDownloadLink href={`/api/pdf/bulletin?id=${card.id}`} description={`bulletin du ${card.periodLabel}`} />
          {attestation}
        </div>
      </div>

      <ReportCardSheet card={card} student={student} />
      {/* Paper version, laid out like the PDF: shown only when printing. */}
      {printable && <PrintReportCard className="hidden print:block" data={printable.data} meta={{ ...printMeta, issuer: printable.issuer }} />}
    </div>
  );
}
