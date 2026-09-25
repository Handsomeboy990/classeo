import { GENDER_LABELS } from "@/features/students/labels";
import { mention } from "@/lib/domain/grades";
import { formatAverage } from "@/lib/utils";

import type { ReportCardData } from "../documents/report-card";
import { beninDate, calendarShort, officialName, ordinal } from "../format";
import type { DocumentMeta } from "../layout";

import { PrintInfoGrid, PrintSheet, PrintSignatures } from "./sheet";

// A report card printed from the browser, the HTML twin of the PDF page.
export function PrintReportCard({ data, meta, className, footnote }: { data: ReportCardData; meta: DocumentMeta; className?: string; footnote?: string }) {
  const { card, student: s } = data;
  const graded = card.lines.filter((l) => l.average !== null);
  const totalCoef = graded.reduce((a, l) => a + l.coefficient, 0);
  const totalPoints = graded.reduce((a, l) => a + (l.average ?? 0) * l.coefficient, 0);
  const m = mention(card.generalAverage);

  return (
    <PrintSheet id="bulletin" meta={meta} className={className}>
      <PrintInfoGrid
        items={[
          { label: "Élève", value: officialName(s.lastName, s.firstName) },
          { label: "Matricule", value: s.matricule },
          { label: "Classe", value: `${data.classroom.name}${data.isRepeating ? " (redoublant)" : ""}` },
          { label: "Effectif", value: `${card.classSize} élèves` },
          { label: "Né(e) le", value: `${calendarShort(s.birthDate)}${s.birthPlace ? ` à ${s.birthPlace}` : ""}` },
          { label: "Sexe", value: GENDER_LABELS[s.gender] },
          { label: "Année scolaire", value: data.yearLabel },
          { label: "Professeur principal", value: data.classroom.mainTeacher ?? "Non désigné" },
        ]}
      />
      {data.mode === "preview" && (
        <p className="doc-notice doc-keep mt-3 text-sm">
          <strong>Aperçu non publié.</strong> Calculé à partir des notes actuelles, sans valeur officielle avant la publication du bulletin.
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="doc-table">
          <caption className="sr-only">Moyennes par matière</caption>
          <thead>
            <tr>
              <th scope="col">Matière</th>
              <th scope="col" className="max-sm:hidden print:table-cell">
                Enseignant
              </th>
              <th scope="col" className="doc-center">
                Coef.
              </th>
              <th scope="col" className="doc-num">
                Moyenne /20
              </th>
              <th scope="col" className="doc-num">
                Points
              </th>
              <th scope="col" className="doc-num">
                Rang
              </th>
              <th scope="col">Mention</th>
            </tr>
          </thead>
          <tbody>
            {card.lines.map((l) => (
              <tr key={l.subject}>
                <th scope="row" className="font-semibold">
                  {l.subject}
                </th>
                <td className="doc-muted text-xs max-sm:hidden print:table-cell">{l.teacher ?? "–"}</td>
                <td className="doc-center tabular-nums">{l.coefficient}</td>
                <td className="doc-num font-semibold">{formatAverage(l.average)}</td>
                <td className="doc-num">{l.average === null ? "–" : formatAverage(l.average * l.coefficient)}</td>
                <td className="doc-num">{ordinal(l.rank)}</td>
                <td>{mention(l.average)?.label ?? "Non noté"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td className="max-sm:hidden print:table-cell" />
              <td className="doc-center tabular-nums">{totalCoef}</td>
              <td />
              <td className="doc-num">{formatAverage(totalPoints)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="doc-keep mt-5 grid gap-3 sm:grid-cols-3 print:grid-cols-3">
        <div className="doc-figure doc-primary">
          <p className="doc-label">Moyenne générale</p>
          <strong>{card.generalAverage === null ? "–" : `${formatAverage(card.generalAverage)} / 20`}</strong>
          <p className="doc-muted text-xs">{m ? `Mention : ${m.label}` : "Aucune moyenne calculée"}</p>
        </div>
        <div className="doc-figure">
          <p className="doc-label">Rang</p>
          <strong>{ordinal(card.rank)}</strong>
          <p className="doc-muted text-xs">sur {card.classSize} élèves</p>
        </div>
        {data.classAverage !== undefined ? (
          <div className="doc-figure">
            <p className="doc-label">Moyenne de la classe</p>
            <strong>{data.classAverage === null ? "–" : `${formatAverage(data.classAverage)} / 20`}</strong>
          </div>
        ) : null}
      </div>
      <div className="doc-box doc-keep mt-3 px-4 py-3">
        <p className="doc-label">Appréciation générale</p>
        <p className="mt-0.5 font-semibold">{card.appreciation ?? "–"}</p>
      </div>

      <PrintSignatures
        items={[
          { role: "Le professeur principal", name: data.classroom.mainTeacher },
          { role: "Le chef d'établissement", name: data.mode === "published" ? card.publishedBy : null, stamp: true },
          { role: "Vu par le parent ou tuteur" },
        ]}
      />
      {data.mode === "published" && card.publishedAt && (
        <p className="doc-muted mt-3 text-xs">Bulletin publié le {beninDate(card.publishedAt)}. Seule la version publiée fait foi.</p>
      )}
      {footnote && <p className="doc-no-print doc-muted mt-4 text-xs">{footnote}</p>}
    </PrintSheet>
  );
}
