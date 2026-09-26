import { View } from "@react-pdf/renderer";

import { GENDER_LABELS } from "@/features/students/labels";
import { ATTENDANCE_LABELS, type AttendanceStatusCode } from "@/lib/domain/attendance";
import { mention } from "@/lib/domain/grades";
import { formatAverage, plural } from "@/lib/utils";

import { DataTable, Figure, InfoGrid, Notice, Signatures } from "../components";
import type { PdfPhoto } from "../data/photo";
import { FONT_TITLE } from "../fonts";
import { beninDate, calendarDate, calendarShort, calendarWeekday, officialName } from "../format";
import { DocumentPage, PdfDocument, T, type DocumentMeta } from "../layout";
import { COLORS, styles } from "../theme";

import { PhotoFrame } from "./attestation";

// ---------------------------------------------------------------------------
// Relevé de notes: every grade of the running term, per subject.
// ---------------------------------------------------------------------------

type Grade = { type: "INTERROGATION" | "DEVOIR" | "COMPOSITION"; value: number; maxValue: number };

export type TranscriptData = {
  student: { firstName: string; lastName: string; matricule: string; gender: "F" | "M"; birthDate: Date };
  classroom: string;
  yearLabel: string;
  periodName: string;
  average: number | null;
  subjects: {
    subject: string;
    teacher: string | null;
    coefficient: number;
    grades: Grade[];
    interrogationAverage: number | null;
    devoirAverage: number | null;
    compositionAverage: number | null;
    average: number | null;
  }[];
};

function gradeList(grades: Grade[], type: Grade["type"]) {
  const list = grades.filter((g) => g.type === type);
  if (!list.length) return "–";
  return list.map((g) => (g.maxValue === 20 ? formatAverage(g.value) : `${formatAverage(g.value)}/${g.maxValue}`)).join("  ");
}

function Transcript({ data, meta }: { data: TranscriptData; meta: DocumentMeta }) {
  const graded = data.subjects.filter((s) => s.average !== null);
  const coef = graded.reduce((a, s) => a + s.coefficient, 0);
  const points = graded.reduce((a, s) => a + (s.average ?? 0) * s.coefficient, 0);
  const m = mention(data.average);
  const s = data.student;
  return (
    <DocumentPage meta={meta}>
      <InfoGrid
        columns={3}
        items={[
          { label: "Élève", value: officialName(s.lastName, s.firstName) },
          { label: "Matricule", value: s.matricule },
          { label: "Classe", value: data.classroom },
          { label: s.gender === "F" ? "Née le" : "Né le", value: calendarDate(s.birthDate) },
          { label: "Période", value: `${data.periodName}, ${data.yearLabel}` },
          { label: "Sexe", value: GENDER_LABELS[s.gender] },
        ]}
      />
      <View style={{ marginTop: 10 }}>
        <Notice tone="info" title="Relevé provisoire">
          Notes saisies à ce jour. La moyenne évolue jusqu&apos;à la clôture de la période ; seul le bulletin publié fait foi.
        </Notice>
      </View>
      <DataTable
        columns={[
          {
            header: "Matière",
            flex: 2.7,
            render: (r: TranscriptData["subjects"][number]) => (
              <View>
                <T style={{ fontSize: 9, fontWeight: 600 }}>{r.subject}</T>
                {r.teacher ? <T style={{ fontSize: 7, color: COLORS.muted }}>{r.teacher}</T> : null}
              </View>
            ),
          },
          { header: "Coef.", flex: 0.55, align: "center", render: (r) => String(r.coefficient) },
          { header: "Interrogations", flex: 1.8, render: (r) => gradeList(r.grades, "INTERROGATION") },
          { header: "Moy. int.", flex: 0.95, align: "right", render: (r) => formatAverage(r.interrogationAverage) },
          { header: "Devoirs", flex: 1.1, render: (r) => gradeList(r.grades, "DEVOIR") },
          { header: "Compo.", flex: 0.85, align: "right", render: (r) => formatAverage(r.compositionAverage) },
          { header: "Moy. /20", flex: 0.95, align: "right", render: (r) => <T style={{ fontSize: 9.5, fontWeight: 700, textAlign: "right" }}>{formatAverage(r.average)}</T> },
          { header: "Points", flex: 0.85, align: "right", render: (r) => (r.average === null ? "–" : formatAverage(r.average * r.coefficient)) },
        ]}
        rows={data.subjects}
        footer={["Total", String(coef), "", "", "", "", formatAverage(data.average), formatAverage(points)]}
        empty="Aucune matière pour cette classe."
      />
      <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }} wrap={false}>
        <Figure big tone="primary" label="Moyenne provisoire" value={data.average === null ? "–" : `${formatAverage(data.average)} / 20`} hint={m ? `Mention : ${m.label}` : null} />
        <Figure big label="Matières notées" value={`${graded.length} sur ${data.subjects.length}`} hint="Une matière sans note ne compte pas" />
      </View>
      <View style={{ marginTop: 10 }} wrap={false}>
        <View>
          <T style={styles.label}>Règle de calcul</T>
          <T style={[styles.small, { marginTop: 2 }]}>
            Moyenne d&apos;une matière : (moyenne des interrogations + devoir + 2 × composition) ÷ 4, les éléments manquants retirés avec leur poids. Moyenne générale
            pondérée par les coefficients.
          </T>
        </View>
      </View>
    </DocumentPage>
  );
}

export const transcriptPdf = (data: TranscriptData, meta: DocumentMeta) => (
  <PdfDocument title={`Relevé de notes, ${data.student.lastName} ${data.student.firstName}`} author={meta.issuer.name}>
    <Transcript data={data} meta={meta} />
  </PdfDocument>
);

// ---------------------------------------------------------------------------
// Liste de classe.
// ---------------------------------------------------------------------------

export type ClassListData = {
  classroom: string;
  level: string;
  yearLabel: string;
  mainTeacher: string | null;
  showPhones: boolean;
  students: { matricule: string; firstName: string; lastName: string; gender: "F" | "M"; birthDate: Date; isRepeating: boolean; guardianPhone: string | null; guardianName: string | null }[];
};

function ClassList({ data, meta }: { data: ClassListData; meta: DocumentMeta }) {
  const girls = data.students.filter((s) => s.gender === "F").length;
  const repeating = data.students.filter((s) => s.isRepeating).length;
  type Row = ClassListData["students"][number];
  return (
    <DocumentPage meta={meta}>
      <InfoGrid
        columns={4}
        items={[
          { label: "Classe", value: `${data.classroom} (${data.level})` },
          { label: "Année scolaire", value: data.yearLabel },
          { label: "Professeur principal", value: data.mainTeacher ?? "Non désigné" },
          { label: "Effectif", value: `${data.students.length} : ${plural(girls, "fille")}, ${plural(data.students.length - girls, "garçon")}` },
        ]}
      />
      <View style={{ marginTop: 12 }}>
        <DataTable
          columns={[
            { header: "N°", width: 24, align: "right", render: (_r: Row, i) => String(i + 1) },
            { header: "Nom et prénoms", flex: 3, render: (r) => <T style={{ fontSize: 9, fontWeight: 600 }}>{officialName(r.lastName, r.firstName)}{r.isRepeating ? <T style={{ fontWeight: 400, color: COLORS.muted }}> (R)</T> : null}</T> },
            { header: "Matricule", flex: 1.4, render: (r) => r.matricule },
            { header: "Sexe", width: 34, align: "center", render: (r) => r.gender },
            { header: "Date de naissance", flex: 1.2, render: (r) => calendarShort(r.birthDate) },
            ...(data.showPhones
              ? [
                  {
                    header: "Parent ou tuteur",
                    flex: 2.6,
                    render: (r: Row) =>
                      r.guardianPhone ? (
                        <T style={{ fontSize: 8.5 }}>
                          {r.guardianPhone}
                          <T style={{ fontSize: 7.5, color: COLORS.muted }}>{r.guardianName ? `  ${r.guardianName}` : ""}</T>
                        </T>
                      ) : (
                        "–"
                      ),
                  },
                ]
              : []),
          ]}
          rows={data.students}
          empty="Aucun élève inscrit dans cette classe."
        />
      </View>
      <T style={[styles.small, styles.muted, { marginTop: 6 }]}>
        (R) redoublant, {repeating} dans la classe. Sexe : F fille, M garçon.{data.showPhones ? " Numéros réservés au suivi des élèves : ne pas diffuser." : ""}
      </T>
    </DocumentPage>
  );
}

export const classListPdf = (data: ClassListData, meta: DocumentMeta) => (
  <PdfDocument title={`Liste de la classe ${data.classroom}`} author={meta.issuer.name}>
    <ClassList data={data} meta={meta} />
  </PdfDocument>
);

// ---------------------------------------------------------------------------
// Fiche d'appel: the register of a class for a date, pre-filled with the
// statuses already recorded, with boxes for the halves not yet taken.
// ---------------------------------------------------------------------------

export type AttendanceSheetData = {
  classroom: string;
  date: Date;
  yearLabel: string;
  rows: { name: string; matricule: string; morning: { status: AttendanceStatusCode | null; reason: string }; afternoon: { status: AttendanceStatusCode | null; reason: string } }[];
  recordedBy: { morning: string | null; afternoon: string | null };
};

const STATUS_SHORT: Record<AttendanceStatusCode, string> = { PRESENT: "P", ABSENT: "A", LATE: "R", EXCUSED: "E" };

function StatusCell({ status }: { status: AttendanceStatusCode | null }) {
  if (!status) return <View style={{ width: 16, height: 12, borderWidth: 0.75, borderColor: COLORS.border, borderRadius: 2, alignSelf: "center" }} />;
  const tone = status === "ABSENT" ? COLORS.danger : status === "LATE" ? COLORS.warning : status === "EXCUSED" ? COLORS.info : COLORS.primaryDark;
  return <T style={{ fontSize: 9, fontWeight: 700, color: tone, textAlign: "center" }}>{STATUS_SHORT[status]}</T>;
}

function AttendanceSheet({ data, meta }: { data: AttendanceSheetData; meta: DocumentMeta }) {
  type Row = AttendanceSheetData["rows"][number];
  const count = (half: "morning" | "afternoon", s: AttendanceStatusCode) => data.rows.filter((r) => r[half].status === s).length;
  const taken = (half: "morning" | "afternoon") => data.rows.some((r) => r[half].status !== null);
  const summary = (half: "morning" | "afternoon") =>
    taken(half) ? `${count(half, "PRESENT") + count(half, "LATE")} présents, ${count(half, "ABSENT")} absents, ${count(half, "LATE")} retards, ${count(half, "EXCUSED")} excusés` : "Appel à faire";
  return (
    <DocumentPage meta={meta}>
      <InfoGrid
        columns={3}
        items={[
          { label: "Classe", value: data.classroom },
          { label: "Date", value: calendarWeekday(data.date) },
          { label: "Effectif", value: plural(data.rows.length, "élève") },
          { label: "Matin", value: summary("morning") },
          { label: "Après-midi", value: summary("afternoon") },
          { label: "Année scolaire", value: data.yearLabel },
        ]}
      />
      <View style={{ marginTop: 12 }}>
        <DataTable
          rowHeight={19}
          columns={[
            { header: "N°", width: 24, align: "right", render: (_r: Row, i) => String(i + 1) },
            { header: "Élève", flex: 3, render: (r) => <T style={{ fontSize: 9, fontWeight: 600 }}>{r.name}</T> },
            { header: "Matricule", flex: 1.3, render: (r) => r.matricule },
            { header: "Matin", width: 46, align: "center", render: (r) => <StatusCell status={r.morning.status} /> },
            { header: "Après-midi", width: 58, align: "center", render: (r) => <StatusCell status={r.afternoon.status} /> },
            { header: "Motif ou observation", flex: 2.6, render: (r) => [r.morning.reason, r.afternoon.reason].filter(Boolean).join(" ; ") || "" },
          ]}
          rows={data.rows}
          empty="Aucun élève inscrit dans cette classe."
        />
      </View>
      <T style={[styles.small, styles.muted, { marginTop: 6 }]}>
        {`${(Object.entries(STATUS_SHORT) as [AttendanceStatusCode, string][]).map(([k, v]) => `${v} ${ATTENDANCE_LABELS[k].toLowerCase()}`).join(", ")}. Case vide : à remplir lors de l'appel, puis à saisir dans Classéo.`}
      </T>
      <Signatures
        items={[
          { role: "Appel du matin", name: data.recordedBy.morning },
          { role: "Appel de l'après-midi", name: data.recordedBy.afternoon },
          { role: "Visa de la direction", stamp: true },
        ]}
      />
    </DocumentPage>
  );
}

export const attendanceSheetPdf = (data: AttendanceSheetData, meta: DocumentMeta) => (
  <PdfDocument title={`Fiche d'appel ${data.classroom}`} author={meta.issuer.name}>
    <AttendanceSheet data={data} meta={meta} />
  </PdfDocument>
);

// ---------------------------------------------------------------------------
// Attestation de scolarité.
// ---------------------------------------------------------------------------

export type CertificateData = {
  student: { firstName: string; lastName: string; matricule: string; gender: "F" | "M"; birthDate: Date; birthPlace: string | null };
  classroom: string;
  level: string;
  yearLabel: string;
  // First day of the earliest school year the student spent in this school.
  enrolledSince: Date;
  school: { name: string; commune: string };
  // The active head of the school, who signs.
  director: { name: string; gender: "F" | "M" | null } | null;
  photo?: PdfPhoto | null;
};

function Certificate({ data, meta }: { data: CertificateData; meta: DocumentMeta }) {
  const s = data.student;
  const she = s.gender === "F";
  const line = { fontSize: 11.5, lineHeight: 1.7 };
  // The signer speaks in the first person when their gender is known
  // ("Je soussignée", "directrice"); otherwise the school head attests.
  const head = data.director;
  const signer = head?.gender ? { ...head, woman: head.gender === "F" } : null;
  const headTitle = signer ? (signer.woman ? "La directrice" : "Le directeur") : "Le chef d'établissement";
  return (
    <DocumentPage meta={meta}>
      <View style={{ marginTop: 28, paddingHorizontal: 18 }}>
        <T style={[line]}>
          {signer ? (
            <>
              {signer.woman ? "Je soussignée" : "Je soussigné"}, <T style={{ fontWeight: 700 }}>{signer.name}</T>, {signer.woman ? "directrice" : "directeur"} de
              l&apos;établissement <T style={{ fontWeight: 700 }}>{data.school.name}</T>, atteste que :
            </>
          ) : head ? (
            <>
              <T style={{ fontWeight: 700 }}>{head.name}</T>, chef de l&apos;établissement <T style={{ fontWeight: 700 }}>{data.school.name}</T>, atteste que :
            </>
          ) : (
            <>
              Le chef de l&apos;établissement <T style={{ fontWeight: 700 }}>{data.school.name}</T> atteste que :
            </>
          )}
        </T>
        <View style={{ marginVertical: 18, marginHorizontal: 30, paddingVertical: 14, paddingHorizontal: 18, borderLeftWidth: 3, borderLeftColor: COLORS.primary, backgroundColor: COLORS.soft, flexDirection: "row", gap: 14, alignItems: "center" }}>
          <PhotoFrame photo={data.photo} width={62} />
          <View style={{ flex: 1 }}>
            <T style={{ fontFamily: FONT_TITLE, fontWeight: 700, fontSize: 17, color: COLORS.primaryDark }}>{officialName(s.lastName, s.firstName)}</T>
            <T style={{ fontSize: 10.5, marginTop: 4 }}>
              {she ? "Née" : "Né"} le {calendarDate(s.birthDate)}
              {s.birthPlace ? ` à ${s.birthPlace}` : ""}
            </T>
            <T style={{ fontSize: 10.5 }}>
              Matricule {s.matricule} · {GENDER_LABELS[s.gender]}
            </T>
          </View>
        </View>
        <T style={[line]}>
          est régulièrement {she ? "inscrite" : "inscrit"} dans notre établissement en classe de <T style={{ fontWeight: 700 }}>{data.classroom}</T> ({data.level}) au titre de
          l&apos;année scolaire <T style={{ fontWeight: 700 }}>{data.yearLabel}</T>. {she ? "Elle" : "Il"} y est {she ? "inscrite" : "inscrit"} depuis le{" "}
          {calendarDate(data.enrolledSince)}.
        </T>
        <T style={[line, { marginTop: 12 }]}>En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de droit.</T>
        <View style={{ marginTop: 28, alignItems: "flex-end" }} wrap={false}>
          <T style={{ fontSize: 11 }}>
            Fait à {data.school.commune}, le {beninDate(meta.generatedAt)}
          </T>
          <View style={{ width: 230, marginTop: 4 }}>
            <Signatures items={[{ role: headTitle, name: head?.name ?? null, stamp: true }]} />
          </View>
        </View>
      </View>
      <View style={{ position: "absolute", bottom: 78, left: 58, right: 58 }}>
        <T style={[styles.small, styles.muted, { textAlign: "center" }]}>
          Attestation valable pour l&apos;année scolaire {data.yearLabel}. Toute rature ou surcharge la rend nulle. L&apos;établissement peut confirmer son authenticité à partir de la
          référence {meta.reference}.
        </T>
      </View>
    </DocumentPage>
  );
}

export const certificatePdf = (data: CertificateData, meta: DocumentMeta) => (
  <PdfDocument title={`Attestation de scolarité, ${data.student.lastName} ${data.student.firstName}`} author={meta.issuer.name}>
    <Certificate data={data} meta={meta} />
  </PdfDocument>
);
