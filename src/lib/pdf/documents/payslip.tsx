import { View } from "@react-pdf/renderer";

import { monthLabel } from "@/lib/domain/payroll";
import { TEACHER_STATUS_LABELS, type TeacherStatus } from "@/lib/domain/teacher-status";

import { DataTable, Figure, FigureRow, InfoGrid, SectionTitle, Signatures } from "../components";
import { amountSentence, beninDate, officialName, pdfFcfa } from "../format";
import { DocumentPage, PdfDocument, T, type DocumentMeta } from "../layout";
import { styles } from "../styles";

export type PayslipData = {
  teacher: { firstName: string; lastName: string; matricule: string; status: TeacherStatus | null; specialty: string | null };
  month: string;
  baseAmount: number;
  allowances: number;
  allowancesNote: string | null;
  deductions: number;
  deductionsNote: string | null;
  grossAmount: number;
  netAmount: number;
  status: "DRAFT" | "APPROVED" | "PAID";
  approvedAt: Date | null;
  paidAt: Date | null;
};

type Line = { label: string; gain: number | null; deduction: number | null };

// Monthly payslip of a teacher paid by the school (a vacataire or a private
// teacher), with the reference and QR code of every issued document.
function Payslip({ data, meta }: { data: PayslipData; meta: DocumentMeta }) {
  const lines: Line[] = [
    { label: "Salaire de base", gain: data.baseAmount, deduction: null },
    ...(data.allowances ? [{ label: data.allowancesNote ? `Primes : ${data.allowancesNote}` : "Primes", gain: data.allowances, deduction: null }] : []),
    ...(data.deductions ? [{ label: data.deductionsNote ? `Retenues : ${data.deductionsNote}` : "Retenues", gain: null, deduction: data.deductions }] : []),
  ];
  return (
    <DocumentPage meta={meta}>
      <InfoGrid
        columns={3}
        items={[
          { label: "Enseignant", value: officialName(data.teacher.lastName, data.teacher.firstName) },
          { label: "Matricule", value: data.teacher.matricule },
          { label: "Mois", value: monthLabel(data.month) },
          { label: "Statut", value: data.teacher.status ? TEACHER_STATUS_LABELS[data.teacher.status] : "Non renseigné" },
          { label: "Spécialité", value: data.teacher.specialty ?? "–" },
          { label: "Payé le", value: data.paidAt ? beninDate(data.paidAt) : "Non encore payé" },
        ]}
      />
      <View style={styles.section}>
        <SectionTitle>Éléments de la paie</SectionTitle>
        <DataTable
          columns={[
            { header: "Rubrique", flex: 3, render: (l: Line) => l.label },
            { header: "Gains", flex: 1, align: "right", render: (l: Line) => (l.gain === null ? "" : pdfFcfa(l.gain)) },
            { header: "Retenues", flex: 1, align: "right", render: (l: Line) => (l.deduction === null ? "" : pdfFcfa(l.deduction)) },
          ]}
          rows={lines}
          footer={["Totaux", pdfFcfa(data.grossAmount), pdfFcfa(data.deductions)]}
        />
      </View>
      <View style={styles.section}>
        <FigureRow>
          <Figure label="Salaire brut" value={pdfFcfa(data.grossAmount)} />
          <Figure label="Retenues" value={pdfFcfa(data.deductions)} />
          <Figure label="Net à payer" value={pdfFcfa(data.netAmount)} tone="primary" big />
        </FigureRow>
        <T style={{ fontSize: 9.5, marginTop: 8 }}>
          Arrêté le présent bulletin à la somme nette de <T style={{ fontWeight: 700 }}>{amountSentence(data.netAmount)}</T>.
        </T>
      </View>
      <View style={{ flexDirection: "row", gap: 16, marginTop: 18 }} wrap={false}>
        <View style={{ flex: 1 }}>
          <T style={[styles.small, styles.muted]}>
            Bulletin établi par l&apos;établissement, employeur de l&apos;enseignant. Les agents de l&apos;État reçoivent le leur du ministère de l&apos;Économie et des Finances.
          </T>
        </View>
        <View style={{ flex: 1 }}>
          <Signatures marginTop={0} items={[{ role: "Pour l'établissement", stamp: true }]} />
        </View>
      </View>
    </DocumentPage>
  );
}

export const payslipPdf = (data: PayslipData, meta: DocumentMeta) => (
  <PdfDocument title={`Bulletin de paie, ${data.teacher.lastName} ${data.teacher.firstName}, ${monthLabel(data.month)}`} author={meta.issuer.name}>
    <Payslip data={data} meta={meta} />
  </PdfDocument>
);
