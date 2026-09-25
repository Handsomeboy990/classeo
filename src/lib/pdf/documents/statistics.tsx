import { View } from "@react-pdf/renderer";

import { formatIndicator } from "@/features/statistics/format";
import { INDICATORS, type IndicatorKey, type Indicators } from "@/lib/domain/indicators";

import { DataTable, Figure, FigureRow, SectionTitle } from "../components";
import { beninDateTime, pdfText } from "../format";
import { DocumentPage, PdfDocument, T, type DocumentMeta } from "../layout";
import { COLORS, styles } from "../theme";

export type StatisticsData = {
  scopeName: string;
  trail: string[];
  childLabel: { singular: string; plural: string };
  yearLabel: string | null;
  previousYearLabel: string | null;
  total: Indicators;
  children: { name: string; indicators: Indicators }[];
  computedAt: Date;
};

const TILES: IndicatorKey[] = ["schools", "enrollments", "girlsShare", "teachers", "studentsPerTeacher", "absenceRate", "passRate", "meanAverage"];
const COLUMNS: IndicatorKey[] = ["schools", "enrollments", "girlsShare", "disabled", "teachers", "studentsPerTeacher", "averageClassSize", "absenceRate", "passRate", "meanAverage", "pendingRequests"];

const TILE_LABELS: Partial<Record<IndicatorKey, string>> = {
  schools: "Établissements",
  enrollments: "Élèves inscrits",
  girlsShare: "Part des filles",
  teachers: "Enseignants",
  studentsPerTeacher: "Élèves/enseignant",
  absenceRate: "Taux d'absence",
  passRate: "Réussite",
  meanAverage: "Moyenne",
};

// Column headings on one line.
const HEADINGS: Partial<Record<IndicatorKey, string>> = {
  teachers: "Enseign.",
  averageClassSize: "Élèves/cl.",
};

const fmt = (k: IndicatorKey, v: number | null | undefined) => pdfText(formatIndicator(k, v));

function Statistics({ data, meta }: { data: StatisticsData; meta: DocumentMeta }) {
  // A school's breakdown is by class: the school count means nothing there.
  const columns = data.childLabel.singular === "Classe" ? COLUMNS.filter((k) => k !== "schools" && k !== "pendingRequests") : COLUMNS;
  const tiles = data.childLabel.singular === "Classe" ? TILES.filter((k) => k !== "schools") : TILES;
  type Row = StatisticsData["children"][number];
  return (
    <DocumentPage
      meta={meta}
      orientation="landscape"
      header={
        <T style={[styles.small, styles.muted, { marginTop: 5 }]}>
          {data.trail.filter(Boolean).join(" › ")} · effectifs {data.yearLabel ?? "de l'année en cours"}, résultats {data.previousYearLabel ?? "de l'année précédente"}
        </T>
      }
    >
      <FigureRow>
        {tiles.map((k) => (
          <Figure
            key={k}
            label={TILE_LABELS[k] ?? INDICATORS[k].label}
            value={fmt(k, data.total[k])}
            hint={k === "passRate" || k === "meanAverage" ? (data.previousYearLabel ? `Année ${data.previousYearLabel}` : "Année précédente") : null}
            tone={k === "enrollments" ? "primary" : "plain"}
            compact
          />
        ))}
      </FigureRow>

      <View style={{ marginTop: 10 }}>
        <SectionTitle>{`Détail par ${data.childLabel.singular.toLowerCase()}`}</SectionTitle>
        <DataTable
          dense
          fontSize={8.2}
          columns={[
            { header: data.childLabel.singular, flex: 2.6, render: (r: Row) => <T style={{ fontSize: 8.2, fontWeight: 600 }}>{r.name}</T> },
            ...columns.map((k) => ({ header: HEADINGS[k] ?? INDICATORS[k].short, flex: 1, align: "right" as const, render: (r: Row) => fmt(k, r.indicators[k]) })),
          ]}
          rows={data.children}
          footer={[`Total ${data.scopeName}`, ...columns.map((k) => fmt(k, data.total[k]))]}
          empty={`Aucun${data.childLabel.singular === "Classe" ? "e" : ""} ${data.childLabel.singular.toLowerCase()} dans ce périmètre.`}
        />
      </View>

      <T style={{ marginTop: 6, fontSize: 6.8, color: COLORS.muted }}>
        Absences : demi-journées absentes ou excusées sur les demi-journées relevées, un retard compte comme présent. Réussite : part des élèves dont la moyenne annuelle
        de l&apos;année précédente atteint 10 sur 20. Élèves/cl. : effectif moyen par classe. Calculé le {beninDateTime(data.computedAt)}, avec les mêmes règles à chaque
        niveau du territoire.
      </T>
    </DocumentPage>
  );
}

export const statisticsPdf = (data: StatisticsData, meta: DocumentMeta) => (
  <PdfDocument title={`Statistiques, ${data.scopeName}`} author={meta.issuer.name}>
    <Statistics data={data} meta={meta} />
  </PdfDocument>
);
