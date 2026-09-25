import { View } from "@react-pdf/renderer";

import { GENDER_LABELS } from "@/features/students/labels";

import { DataTable, Signatures } from "../components";
import { FONT_TITLE } from "../fonts";
import { beninDate, calendarDate, officialName } from "../format";
import { DocumentPage, PdfDocument, T, type DocumentMeta } from "../layout";
import { COLORS, styles } from "../theme";

// Certificat de scolarité: the whole schooling of a pupil in the school,
// year by year, where the attestation covers the running year only.

export type SchoolCertificateData = {
  student: { firstName: string; lastName: string; matricule: string; gender: "F" | "M"; birthDate: Date; birthPlace: string | null };
  school: { name: string; commune: string };
  current: { classroom: string; level: string; yearLabel: string };
  history: { yearLabel: string; classroom: string; level: string; status: "ACTIVE" | "TRANSFERRED" | "WITHDRAWN"; isRepeating: boolean }[];
  director: { name: string; gender: "F" | "M" | null } | null;
};

const STATUS: Record<SchoolCertificateData["history"][number]["status"], string> = {
  ACTIVE: "Inscrit",
  TRANSFERRED: "Transféré",
  WITHDRAWN: "Retiré",
};

function Certificate({ data, meta }: { data: SchoolCertificateData; meta: DocumentMeta }) {
  const s = data.student;
  const she = s.gender === "F";
  const line = { fontSize: 11, lineHeight: 1.65 };
  const head = data.director;
  const woman = head?.gender === "F";
  const headTitle = head?.gender ? (woman ? "La directrice" : "Le directeur") : "Le chef d'établissement";
  return (
    <DocumentPage meta={meta}>
      <View style={{ marginTop: 18, paddingHorizontal: 14 }}>
        <T style={line}>
          {head ? (
            <>
              {head.gender ? (woman ? "Je soussignée" : "Je soussigné") : "Le chef d'établissement"}, <T style={{ fontWeight: 700 }}>{head.name}</T>,{" "}
              {head.gender ? (woman ? "directrice" : "directeur") : "chef"} de l&apos;établissement <T style={{ fontWeight: 700 }}>{data.school.name}</T>, certifie que :
            </>
          ) : (
            <>
              Le chef de l&apos;établissement <T style={{ fontWeight: 700 }}>{data.school.name}</T> certifie que :
            </>
          )}
        </T>
        <View style={{ marginVertical: 14, marginHorizontal: 24, paddingVertical: 12, paddingHorizontal: 16, borderLeftWidth: 3, borderLeftColor: COLORS.primary, backgroundColor: COLORS.soft }}>
          <T style={{ fontFamily: FONT_TITLE, fontWeight: 700, fontSize: 16, color: COLORS.primaryDark }}>{officialName(s.lastName, s.firstName)}</T>
          <T style={{ fontSize: 10.5, marginTop: 3 }}>
            {she ? "Née" : "Né"} le {calendarDate(s.birthDate)}
            {s.birthPlace ? ` à ${s.birthPlace}` : ""} · Matricule {s.matricule} · {GENDER_LABELS[s.gender]}
          </T>
        </View>
        <T style={line}>
          a suivi sa scolarité dans notre établissement comme indiqué ci-dessous, et y est {she ? "inscrite" : "inscrit"} pour l&apos;année scolaire{" "}
          <T style={{ fontWeight: 700 }}>{data.current.yearLabel}</T> en classe de <T style={{ fontWeight: 700 }}>{data.current.classroom}</T> ({data.current.level}).
        </T>
      </View>
      <View style={{ marginTop: 12 }}>
        <DataTable
          columns={[
            { header: "Année scolaire", flex: 1.2, render: (r: SchoolCertificateData["history"][number]) => r.yearLabel },
            { header: "Classe", flex: 1, render: (r) => r.classroom },
            { header: "Niveau", flex: 1.2, render: (r) => r.level },
            { header: "Situation", flex: 1.2, render: (r) => `${STATUS[r.status]}${r.isRepeating ? ", redoublant" : ""}` },
          ]}
          rows={data.history}
        />
      </View>
      <T style={[line, { marginTop: 12, paddingHorizontal: 14 }]}>En foi de quoi, le présent certificat est délivré pour servir et valoir ce que de droit.</T>
      <View style={{ marginTop: 18, alignItems: "flex-end" }} wrap={false}>
        <T style={{ fontSize: 11 }}>
          Fait à {data.school.commune}, le {beninDate(meta.generatedAt)}
        </T>
        <View style={{ width: 240, marginTop: 4 }}>
          <Signatures items={[{ role: headTitle, name: head?.name ?? null, stamp: true }]} />
        </View>
      </View>
      <T style={[styles.small, styles.muted, { marginTop: 18, textAlign: "center" }]}>Toute rature ou surcharge rend ce certificat nul. Son authenticité se vérifie avec le code imprimé en bas de page.</T>
    </DocumentPage>
  );
}

export const schoolCertificatePdf = (data: SchoolCertificateData, meta: DocumentMeta) => (
  <PdfDocument title={`Certificat de scolarité, ${data.student.lastName} ${data.student.firstName}`} author={meta.issuer.name}>
    <Certificate data={data} meta={meta} />
  </PdfDocument>
);
