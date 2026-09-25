import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AverageLevel } from "@/components/kit/level";
import { ReadAloud } from "@/components/kit/read-aloud";
import { EmptyState } from "@/components/kit/states";
import { Alert } from "@/components/ui/alert";
import { PrintButton } from "@/features/report-cards/components/print-button";
import { printableCard } from "@/features/report-cards/queries";
import { GENDER_LABELS, shortDate } from "@/features/students/labels";
import { can, requirePermission } from "@/lib/auth/authorize";
import { mention } from "@/lib/domain/grades";
import { formatRank, spokenSummary } from "@/lib/domain/report-card";
import { formatAverage, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Bulletin" };

// Printing keeps only the report card: the app shell and buttons disappear.
const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 12mm; }
  body * { visibility: hidden !important; }
  #bulletin, #bulletin * { visibility: visible !important; }
  #bulletin { position: absolute; inset: 0 auto auto 0; width: 100%; border: 0 !important; box-shadow: none !important; }
  #bulletin .no-print { display: none !important; }
}`;

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

  const totalCoef = card.lines.filter((l) => l.average !== null).reduce((a, l) => a + l.coefficient, 0);
  const totalPoints = card.lines.reduce((a, l) => a + (l.average ?? 0) * (l.average !== null ? l.coefficient : 0), 0);
  const m = mention(card.generalAverage);
  const summary = spokenSummary({ name: `${s.firstName} ${s.lastName}`, ...card }, period.name);

  return (
    <>
      <style>{PRINT_CSS}</style>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href={back} className="text-sm font-semibold text-primary hover:underline">
          ← Retour
        </Link>
        <div className="flex flex-wrap gap-2">
          <ReadAloud text={summary} label="Écouter le bulletin" />
          <PrintButton />
        </div>
      </div>
      {mode === "preview" && (
        <Alert tone="warning" className="mb-4" title="Aperçu non publié">
          Ce bulletin est calculé à partir des notes actuelles. Les familles ne le verront qu&apos;après publication.
        </Alert>
      )}

      <article id="bulletin" className="mx-auto max-w-4xl rounded-card border border-border bg-surface p-6 text-text sm:p-8 print:p-0">
        <div className="flex flex-col justify-between gap-4 border-b-2 border-primary pb-4 sm:flex-row">
          <div className="text-sm">
            <p className="font-bold uppercase">République du Bénin</p>
            <p>Ministère des Enseignements</p>
            <p className="mt-2 text-base font-bold">{c.school.name}</p>
            <p className="text-muted">
              {c.school.commune.name}, {c.school.commune.department.name}
              {c.school.phone ? ` · ${c.school.phone}` : ""}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <h1 className="text-2xl font-bold">Bulletin de notes</h1>
            <p className="font-semibold">
              {period.name} · {enrollment.academicYear.label}
            </p>
            {mode === "published" && card.publishedAt && <p className="text-xs text-muted">Publié le {formatDate(card.publishedAt)}</p>}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 py-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted">Élève</dt>
            <dd className="font-bold">{name}</dd>
          </div>
          <div>
            <dt className="text-muted">Matricule</dt>
            <dd className="font-mono">{s.matricule}</dd>
          </div>
          <div>
            <dt className="text-muted">Classe</dt>
            <dd className="font-semibold">
              {c.name}
              {enrollment.isRepeating ? " (redoublant)" : ""}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Né(e) le</dt>
            <dd>
              {shortDate(s.birthDate)}
              {s.birthPlace ? ` à ${s.birthPlace}` : ""} · {GENDER_LABELS[s.gender]}
            </dd>
          </div>
        </dl>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Moyennes par matière</caption>
            <thead>
              <tr className="bg-surface-2 text-left text-xs uppercase">
                <th scope="col" className="border border-border px-3 py-2">
                  Matière
                </th>
                <th scope="col" className="border border-border px-3 py-2 text-right">
                  Coef.
                </th>
                <th scope="col" className="border border-border px-3 py-2 text-right">
                  Moyenne /20
                </th>
                <th scope="col" className="border border-border px-3 py-2 text-right">
                  Points
                </th>
                <th scope="col" className="border border-border px-3 py-2 text-right">
                  Rang
                </th>
                <th scope="col" className="border border-border px-3 py-2">
                  Mention
                </th>
              </tr>
            </thead>
            <tbody>
              {card.lines.map((l) => (
                <tr key={l.subject}>
                  <th scope="row" className="border border-border px-3 py-2 text-left font-medium">
                    {l.subject}
                    {l.teacher && <span className="block text-xs font-normal text-muted">{l.teacher}</span>}
                  </th>
                  <td className="border border-border px-3 py-2 text-right tabular-nums">{l.coefficient}</td>
                  <td className="border border-border px-3 py-2 text-right font-semibold tabular-nums">{formatAverage(l.average)}</td>
                  <td className="border border-border px-3 py-2 text-right tabular-nums">{l.average === null ? "–" : formatAverage(l.average * l.coefficient)}</td>
                  <td className="border border-border px-3 py-2 text-right tabular-nums">{formatRank(l.rank)}</td>
                  <td className="border border-border px-3 py-2">{mention(l.average)?.label ?? "Non noté"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-2 font-bold">
                <th scope="row" className="border border-border px-3 py-2 text-left">
                  Total
                </th>
                <td className="border border-border px-3 py-2 text-right tabular-nums">{totalCoef}</td>
                <td className="border border-border px-3 py-2" />
                <td className="border border-border px-3 py-2 text-right tabular-nums">{formatAverage(totalPoints)}</td>
                <td className="border border-border px-3 py-2" colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted">Moyenne générale</p>
            <div className="mt-2">
              <AverageLevel average={card.generalAverage} size="lg" />
            </div>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted">Rang</p>
            <p className="mt-2 text-2xl font-bold">
              {formatRank(card.rank)} <span className="text-base font-normal text-muted">sur {card.classSize}</span>
            </p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted">Appréciation</p>
            <p className="mt-2 font-semibold">{card.appreciation ?? "–"}</p>
            {m && <p className="text-sm text-muted">Mention : {m.label}</p>}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-muted">Le professeur principal</p>
            <p className="mt-1 font-semibold">{c.mainTeacher ? `${c.mainTeacher.firstName} ${c.mainTeacher.lastName}` : ""}</p>
            <div className="mt-10 border-b border-dashed border-border-strong" aria-hidden />
          </div>
          <div>
            <p className="text-muted">Le chef d&apos;établissement</p>
            <p className="mt-1 font-semibold">{mode === "published" ? card.publishedBy : ""}</p>
            <div className="mt-10 border-b border-dashed border-border-strong" aria-hidden />
          </div>
        </div>
        <p className="no-print mt-6 text-xs text-muted">Résumé lu à voix haute : {summary}</p>
      </article>
    </>
  );
}
