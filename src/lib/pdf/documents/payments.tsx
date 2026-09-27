import { View } from "@react-pdf/renderer";

import { INSTALLMENT_STATUS_LABELS, INVOICE_STATUS_LABELS, PAYMENT_METHOD_LABELS, type InvoiceStatusCode, type PaymentMethodCode } from "@/lib/domain/payments";

import { DataTable, Figure, FigureRow, InfoGrid, Notice, Pill, SectionTitle, Signatures } from "../components";
import { FONT_TITLE } from "../fonts";
import { amountSentence, beninDate, calendarDate, officialName, pdfFcfa } from "../format";
import { DocumentPage, PdfDocument, T, type DocumentMeta } from "../layout";
import { styles } from "../styles";
import { COLORS } from "../theme";

type Student = { firstName: string; lastName: string; matricule: string };

export type ReceiptData = {
  reference: string;
  amount: number;
  method: PaymentMethodCode;
  transactionId: string | null;
  paidAt: Date;
  createdAt: Date;
  recordedBy: string;
  invoice: { number: string; totalAmount: number; paidAmount: number; items: { description: string }[] };
  student: Student;
  classroom: string;
  yearLabel: string;
};

function Receipt({ data, meta }: { data: ReceiptData; meta: DocumentMeta }) {
  const rest = Math.max(0, data.invoice.totalAmount - data.invoice.paidAmount);
  return (
    <DocumentPage meta={meta}>
      <InfoGrid
        columns={3}
        items={[
          { label: "Élève", value: officialName(data.student.lastName, data.student.firstName) },
          { label: "Matricule", value: data.student.matricule },
          { label: "Classe", value: `${data.classroom}, ${data.yearLabel}` },
          { label: "Facture", value: data.invoice.number },
          { label: "Mode de paiement", value: PAYMENT_METHOD_LABELS[data.method] },
          { label: "Transaction", value: data.transactionId ?? "–" },
        ]}
      />

      <View style={{ marginTop: 14, backgroundColor: COLORS.primarySoft, borderLeftWidth: 4, borderLeftColor: COLORS.primary, borderRadius: 4, paddingVertical: 12, paddingHorizontal: 14 }} wrap={false}>
        <T style={[styles.label, { color: COLORS.primary }]}>Montant reçu le {beninDate(data.paidAt)}</T>
        <T style={{ fontFamily: FONT_TITLE, fontWeight: 800, fontSize: 28, lineHeight: 1.1, color: COLORS.primaryDark, marginTop: 3 }}>{pdfFcfa(data.amount)}</T>
        <T style={{ fontSize: 10, marginTop: 5 }}>
          Arrêté le présent reçu à la somme de <T style={{ fontWeight: 700 }}>{amountSentence(data.amount)}</T>.
        </T>
      </View>

      <View style={styles.section}>
        <SectionTitle>Objet du paiement</SectionTitle>
        <T style={{ fontSize: 9.5 }}>{data.invoice.items.map((i) => i.description).join(", ") || "Frais scolaires"}</T>
      </View>

      <View style={styles.section}>
        <SectionTitle>Situation de la facture après ce paiement</SectionTitle>
        <FigureRow>
          <Figure label="Total de la facture" value={pdfFcfa(data.invoice.totalAmount)} />
          <Figure label="Total payé à ce jour" value={pdfFcfa(data.invoice.paidAmount)} />
          <Figure label="Reste à payer" value={rest > 0 ? pdfFcfa(rest) : "Soldée"} tone={rest > 0 ? "warning" : "primary"} />
        </FigureRow>
      </View>

      <View style={{ flexDirection: "row", gap: 16, marginTop: 18 }} wrap={false}>
        <View style={{ flex: 1 }}>
          <T style={styles.label}>Encaissé par</T>
          <T style={{ fontSize: 9.5, fontWeight: 600, marginTop: 2 }}>{data.recordedBy}</T>
          <T style={[styles.small, styles.muted]}>Enregistré le {beninDate(data.createdAt)}</T>
          <T style={[styles.small, styles.muted, { marginTop: 8 }]}>Conservez ce reçu : il vous sera demandé en cas de réclamation.</T>
        </View>
        <View style={{ flex: 1 }}>
          <Signatures marginTop={0} items={[{ role: "Pour l'établissement", stamp: true }]} />
        </View>
      </View>
    </DocumentPage>
  );
}

export const receiptPdf = (data: ReceiptData, meta: DocumentMeta) => (
  <PdfDocument title={`Reçu ${data.reference}`} author={meta.issuer.name}>
    <Receipt data={data} meta={meta} />
  </PdfDocument>
);

export type InvoiceData = {
  number: string;
  status: InvoiceStatusCode;
  issueDate: Date;
  dueDate: Date;
  totalAmount: number;
  paidAmount: number;
  student: Student;
  classroom: string;
  yearLabel: string;
  guardian: { name: string; phone: string } | null;
  items: { description: string; quantity: number; unitPrice: number }[];
  installments: { label: string; dueDate: Date; amount: number; paidAmount: number; status: InvoiceStatusCode }[];
  payments: { reference: string; paidAt: Date; amount: number; method: PaymentMethodCode; transactionId: string | null }[];
};

const statusTone = (s: InvoiceStatusCode) => (s === "PAID" ? "success" : s === "OVERDUE" ? "danger" : s === "CANCELLED" ? "neutral" : "warning");

function Invoice({ data, meta }: { data: InvoiceData; meta: DocumentMeta }) {
  const rest = Math.max(0, data.totalAmount - data.paidAmount);
  return (
    <DocumentPage meta={meta}>
      {data.status === "CANCELLED" ? <Notice tone="danger" title="Facture annulée">Elle ne peut plus recevoir de paiement.</Notice> : null}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1.4, borderWidth: 0.75, borderColor: COLORS.border, borderRadius: 4, padding: 9 }}>
          <T style={styles.label}>Facturé pour</T>
          <T style={{ fontSize: 11, fontWeight: 700, marginTop: 2 }}>{officialName(data.student.lastName, data.student.firstName)}</T>
          <T style={styles.small}>
            Matricule {data.student.matricule} · {data.classroom} · Année {data.yearLabel}
          </T>
          {data.guardian ? (
            <T style={[styles.small, styles.muted, { marginTop: 3 }]}>
              Responsable : {data.guardian.name}, tél. {data.guardian.phone}
            </T>
          ) : null}
        </View>
        <View style={{ flex: 1, borderWidth: 0.75, borderColor: COLORS.border, borderRadius: 4, padding: 9 }}>
          <T style={styles.label}>Facture</T>
          <T style={{ fontSize: 11, fontWeight: 700, marginTop: 2 }}>{data.number}</T>
          <T style={styles.small}>Émise le {calendarDate(data.issueDate)}</T>
          <T style={styles.small}>Échéance finale le {calendarDate(data.dueDate)}</T>
          <View style={{ marginTop: 4 }}>
            <Pill tone={statusTone(data.status)}>{INVOICE_STATUS_LABELS[data.status]}</Pill>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <SectionTitle>Détail</SectionTitle>
        <DataTable
          columns={[
            { header: "Désignation", flex: 3.5, render: (i: InvoiceData["items"][number]) => i.description },
            { header: "Quantité", flex: 1, align: "right", render: (i) => String(i.quantity) },
            { header: "Prix unitaire", flex: 1.6, align: "right", render: (i) => pdfFcfa(i.unitPrice) },
            { header: "Total", flex: 1.6, align: "right", render: (i) => pdfFcfa(i.unitPrice * i.quantity) },
          ]}
          rows={data.items}
          footer={["Total à payer", "", "", pdfFcfa(data.totalAmount)]}
        />
        <T style={[styles.small, styles.muted, { marginTop: 4 }]}>Arrêtée la présente facture à la somme de {amountSentence(data.totalAmount)}.</T>
      </View>

      <View style={styles.section}>
        <SectionTitle>Échéancier</SectionTitle>
        <DataTable
          columns={[
            { header: "Tranche", flex: 2, render: (i: InvoiceData["installments"][number]) => i.label },
            { header: "Échéance", flex: 1.8, render: (i) => calendarDate(i.dueDate) },
            { header: "Montant", flex: 1.5, align: "right", render: (i) => pdfFcfa(i.amount) },
            { header: "Payé", flex: 1.5, align: "right", render: (i) => pdfFcfa(i.paidAmount) },
            { header: "Statut", flex: 1.9, render: (i) => <Pill tone={statusTone(i.status)}>{INSTALLMENT_STATUS_LABELS[i.status]}</Pill> },
          ]}
          rows={data.installments}
          empty="Paiement en une fois."
        />
      </View>

      <View style={styles.section}>
        <FigureRow>
          <Figure label="Montant total" value={pdfFcfa(data.totalAmount)} />
          <Figure label="Déjà payé" value={pdfFcfa(data.paidAmount)} tone="primary" />
          <Figure label="Reste à payer" value={rest > 0 ? pdfFcfa(rest) : "Soldée"} tone={rest > 0 ? "warning" : "primary"} />
        </FigureRow>
      </View>

      <View style={styles.section}>
        <SectionTitle>Paiements reçus</SectionTitle>
        <DataTable
          columns={[
            { header: "Reçu", flex: 1.8, render: (p: InvoiceData["payments"][number]) => p.reference },
            { header: "Date", flex: 1.7, render: (p) => beninDate(p.paidAt) },
            { header: "Mode", flex: 1.6, render: (p) => PAYMENT_METHOD_LABELS[p.method] },
            { header: "Transaction", flex: 1.6, render: (p) => p.transactionId ?? "–" },
            { header: "Montant", flex: 1.4, align: "right", render: (p) => pdfFcfa(p.amount) },
          ]}
          rows={data.payments}
          empty="Aucun paiement reçu pour le moment."
        />
      </View>
      <Signatures items={[{ role: "Le service de la comptabilité", stamp: true }, { role: "Le chef d'établissement", stamp: false }]} />
    </DocumentPage>
  );
}

export const invoicePdf = (data: InvoiceData, meta: DocumentMeta) => (
  <PdfDocument title={`Facture ${data.number}`} author={meta.issuer.name}>
    <Invoice data={data} meta={meta} />
  </PdfDocument>
);
