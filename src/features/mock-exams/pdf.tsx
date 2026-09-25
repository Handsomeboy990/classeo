import { View } from "@react-pdf/renderer";

import { DataTable, Figure, FigureRow, InfoGrid, SectionTitle } from "@/lib/pdf/components";
import { ordinal, pdfText } from "@/lib/pdf/format";
import { DocumentPage, PdfDocument, T, type DocumentMeta } from "@/lib/pdf/layout";
import { COLORS, styles } from "@/lib/pdf/theme";
import { formatAverage, formatNumber, formatPercent } from "@/lib/utils";

import type { ExamDetail, ExamResults } from "./queries";
import { ORGANIZER_LABELS, STATUS_LABELS } from "./rules";

export type ResultsSheetData = { exam: ExamDetail; results: ExamResults; dates: string };

const avg = (v: number | null | undefined) => pdfText(formatAverage(v ?? null));

function ResultsSheet({ data, meta }: { data: ResultsSheetData; meta: DocumentMeta }) {
  const { exam, results } = data;
  const o = results.overall;
  const subjects = exam.subjectList;
  type SchoolRow = ExamResults["schools"][number];
  type Candidate = ExamResults["named"][number];
  return (
    <DocumentPage
      meta={meta}
      orientation="landscape"
      header={
        <T style={[styles.small, styles.muted, { marginTop: 5 }]}>
          {`${exam.level?.name ?? ""} · épreuves ${data.dates} · ${exam.organizerName} (${ORGANIZER_LABELS[exam.organizerLevel]}) · ${STATUS_LABELS[exam.status]}`}
        </T>
      }
    >
      <FigureRow>
        <Figure label="Candidats" value={formatNumber(o.candidates)} tone="primary" compact />
        <Figure label="Résultats complets" value={formatNumber(o.complete)} compact />
        <Figure label="Moyenne générale" value={o.average === null ? "–" : `${avg(o.average)}/20`} compact />
        <Figure label="Moyenne atteinte" value={pdfText(formatPercent(o.passRate))} hint="10 sur 20 ou plus" compact />
        <Figure label="Établissements" value={formatNumber(results.schools.length)} compact />
      </FigureRow>

      <View style={{ marginTop: 10 }}>
        <SectionTitle>Classement des établissements</SectionTitle>
        <DataTable
          dense
          fontSize={8.2}
          columns={[
            { header: "Rang", width: 52, render: (s: SchoolRow) => pdfText(ordinal(s.rank, s.tied)) },
            { header: "Établissement", flex: 2.4, render: (s: SchoolRow) => s.name },
            { header: "Candidats", flex: 0.8, align: "right" as const, render: (s: SchoolRow) => formatNumber(s.candidates) },
            ...subjects.map((sub) => ({ header: sub.code, flex: 0.7, align: "right" as const, render: (s: SchoolRow) => avg(s.subjectAverages[sub.code]) })),
            { header: "Moyenne", flex: 0.9, align: "right" as const, render: (s: SchoolRow) => avg(s.average) },
            { header: "Moy. atteinte", flex: 0.9, align: "right" as const, render: (s: SchoolRow) => pdfText(formatPercent(s.passRate)) },
          ]}
          rows={results.schools}
          footer={["", "Ensemble", formatNumber(o.candidates), ...subjects.map((s) => avg(results.subjectAverages[s.code])), avg(o.average), pdfText(formatPercent(o.passRate))]}
          empty="Aucun établissement participant."
        />
      </View>

      <View style={{ marginTop: 10 }}>
        <SectionTitle>Classement des candidats</SectionTitle>
        <DataTable
          dense
          fontSize={7.8}
          columns={[
            { header: "Rang", width: 52, render: (r: Candidate) => pdfText(ordinal(r.overallRank, r.overallTied)) },
            { header: "Candidat", flex: 2.2, render: (r: Candidate) => r.name },
            { header: "Matricule", flex: 1, render: (r: Candidate) => r.matricule },
            { header: "Établissement, classe", flex: 2, render: (r: Candidate) => `${results.schools.find((s) => s.schoolId === r.schoolId)?.name ?? ""}, ${r.classroomName}` },
            ...subjects.map((sub) => ({ header: sub.code, flex: 0.6, align: "right" as const, render: (r: Candidate) => avg(r.scores[sub.code]) })),
            { header: "Moyenne", flex: 0.8, align: "right" as const, render: (r: Candidate) => avg(r.average) },
            { header: "Rang étab.", flex: 0.8, align: "right" as const, render: (r: Candidate) => pdfText(ordinal(r.schoolRank, r.schoolTied)) },
          ]}
          rows={results.named}
          empty="Aucun candidat dans votre périmètre."
        />
      </View>

      <View style={{ marginTop: 10 }} wrap={false}>
        <InfoGrid columns={Math.min(4, Math.max(1, subjects.length))} items={subjects.map((s) => ({ label: s.code, value: s.name }))} />
      </View>
      <T style={{ marginTop: 6, fontSize: 6.8, color: COLORS.muted }}>
        Notes sur 20, matières à poids égal. Seuls les candidats ayant une note dans chaque matière sont classés ; les ex æquo partagent le même rang. Les noms figurent
        pour les établissements du périmètre du signataire, les autres établissements par leurs seules moyennes.
        {exam.status === "APPROVED" ? " Résultats provisoires : l'examen n'est pas encore clôturé." : ""}
      </T>
    </DocumentPage>
  );
}

export const resultsSheetPdf = (data: ResultsSheetData, meta: DocumentMeta) => (
  <PdfDocument title={`Examen blanc, ${data.exam.title}`} author={meta.issuer.name}>
    <ResultsSheet data={data} meta={meta} />
  </PdfDocument>
);
