import { View } from "@react-pdf/renderer";

import { GENDER_LABELS } from "@/features/students/labels";
import { mention } from "@/lib/domain/grades";
import { formatAverage } from "@/lib/utils";

import { DataTable, Figure, FigureRow, InfoGrid, Notice, Signatures } from "../components";
import { beninDate, calendarDate, officialName, ordinal } from "../format";
import { DocumentPage, PdfDocument, T, type DocumentMeta, type Issuer } from "../layout";
import { COLORS, styles } from "../theme";

export type ReportCardLine = { subject: string; coefficient: number; average: number | null; rank: number | null; teacher?: string | null };

export type ReportCardData = {
  enrollmentId: string;
  mode: "published" | "preview";
  student: { matricule: string; firstName: string; lastName: string; gender: "F" | "M"; birthDate: Date; birthPlace: string | null };
  classroom: { name: string; mainTeacher: string | null };
  isRepeating: boolean;
  yearLabel: string;
  periodName: string;
  card: {
    generalAverage: number | null;
    rank: number | null;
    classSize: number;
    appreciation: string | null;
    lines: ReportCardLine[];
    publishedAt: Date | null;
    publishedBy: string | null;
  };
  classAverage?: number | null;
};

// The body of one report card, shared by the single download and the class
// batch (one page per student).
export function ReportCardPage({ data, meta, issuer }: { data: ReportCardData; meta: DocumentMeta; issuer: Issuer }) {
  const { card, student: s } = data;
  const graded = card.lines.filter((l) => l.average !== null);
  const totalCoef = graded.reduce((a, l) => a + l.coefficient, 0);
  const totalPoints = graded.reduce((a, l) => a + (l.average ?? 0) * l.coefficient, 0);
  const m = mention(card.generalAverage);
  const born = `${calendarDate(s.birthDate)}${s.birthPlace ? ` à ${s.birthPlace}` : ""}`;

  return (
    <DocumentPage
      meta={{ ...meta, issuer }}
      header={
        <View style={{ marginTop: 10 }}>
          <InfoGrid
            columns={4}
            items={[
              { label: "Élève", value: officialName(s.lastName, s.firstName) },
              { label: "Matricule", value: s.matricule },
              { label: "Classe", value: `${data.classroom.name}${data.isRepeating ? " (redoublant)" : ""}` },
              { label: "Effectif", value: `${card.classSize} élèves` },
              { label: "Né(e) le", value: born },
              { label: "Sexe", value: GENDER_LABELS[s.gender] },
              { label: "Année scolaire", value: data.yearLabel },
              { label: "Professeur principal", value: data.classroom.mainTeacher ?? "Non désigné" },
            ]}
          />
        </View>
      }
    >
      {data.mode === "preview" ? (
        <Notice title="Aperçu non publié">Calculé à partir des notes actuelles. Ce document n&apos;a pas de valeur officielle avant la publication du bulletin.</Notice>
      ) : null}

      <DataTable
        columns={[
          { header: "Matière", flex: 2.6, render: (l: ReportCardLine) => <T style={{ fontSize: 9.5, fontWeight: 600 }}>{l.subject}</T> },
          { header: "Enseignant", flex: 1.8, render: (l) => <T style={{ fontSize: 8, color: COLORS.muted }}>{l.teacher ?? "–"}</T> },
          { header: "Coef.", flex: 0.8, align: "center", render: (l) => String(l.coefficient) },
          { header: "Moyenne /20", flex: 1.3, align: "right", render: (l) => formatAverage(l.average) },
          { header: "Points", flex: 1.1, align: "right", render: (l) => (l.average === null ? "–" : formatAverage(l.average * l.coefficient)) },
          { header: "Rang", flex: 0.9, align: "right", render: (l) => ordinal(l.rank) },
          { header: "Mention", flex: 1.6, render: (l) => mention(l.average)?.label ?? "Non noté" },
        ]}
        rows={card.lines}
        footer={["Total", "", String(totalCoef), "", formatAverage(totalPoints), "", ""]}
        empty="Aucune matière notée pour cette période."
      />

      <View style={{ marginTop: 14 }} wrap={false}>
        <FigureRow>
          <Figure big tone="primary" label="Moyenne générale" value={card.generalAverage === null ? "–" : `${formatAverage(card.generalAverage)} / 20`} hint={m ? `Mention : ${m.label}` : "Aucune moyenne calculée"} />
          <Figure big label="Rang" value={ordinal(card.rank)} hint={`sur ${card.classSize} élèves`} />
          {data.classAverage !== undefined ? (
            <Figure big label="Moyenne de la classe" value={data.classAverage === null ? "–" : `${formatAverage(data.classAverage)} / 20`} />
          ) : null}
        </FigureRow>
        <View style={{ marginTop: 8, borderWidth: 0.75, borderColor: COLORS.border, borderRadius: 4, padding: 8 }}>
          <T style={styles.label}>Appréciation générale</T>
          <T style={{ fontSize: 10.5, fontWeight: 600, marginTop: 2 }}>{card.appreciation ?? "–"}</T>
        </View>
      </View>

      <Signatures
        items={[
          { role: "Le professeur principal", name: data.classroom.mainTeacher },
          { role: "Le chef d'établissement", name: data.mode === "published" ? card.publishedBy : null, stamp: true },
          { role: "Vu par le parent ou tuteur" },
        ]}
      />
      {data.mode === "published" && card.publishedAt ? (
        <T style={[styles.small, styles.muted, { marginTop: 8 }]}>Bulletin publié le {beninDate(card.publishedAt)}. Seule la version publiée fait foi.</T>
      ) : null}
    </DocumentPage>
  );
}

type Props = { items: { data: ReportCardData; meta: DocumentMeta }[]; meta: DocumentMeta; title: string };

export function ReportCardDocument({ items, meta, title }: Props) {
  return (
    <PdfDocument title={title} author={meta.issuer.name}>
      {items.map((it) => (
        <ReportCardPage key={it.data.enrollmentId} data={it.data} meta={it.meta} issuer={it.meta.issuer} />
      ))}
    </PdfDocument>
  );
}

export const reportCardPdf = (props: Props) => <ReportCardDocument {...props} />;
