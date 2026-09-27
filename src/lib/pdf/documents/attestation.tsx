/* eslint-disable jsx-a11y/alt-text -- react-pdf images have no alt attribute. */
import { Image, View } from "@react-pdf/renderer";

import { GENDER_LABELS } from "@/features/students/labels";

import { InfoGrid, Signatures } from "../components";
import type { PdfPhoto } from "../data/photo";
import { FONT_TITLE } from "../fonts";
import { beninDate, calendarDate, officialName } from "../format";
import { DocumentPage, PdfDocument, T, type DocumentMeta } from "../layout";
import { styles } from "../styles";
import { COLORS } from "../theme";

// The pupil's photo on an official document: a framed identity picture, or
// nothing at all when the school has not added one (never a placeholder on
// paper).
export function PhotoFrame({ photo, width = 64 }: { photo: PdfPhoto | null | undefined; width?: number }) {
  if (!photo) return null;
  return (
    <View style={{ width, height: width * 1.25, borderWidth: 0.75, borderColor: COLORS.border, borderRadius: 3, padding: 2, backgroundColor: COLORS.white }}>
      <Image src={photo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Certificat de radiation (exeat): delivered by the school a pupil leaves,
// once the new school has accepted the transfer. The certificat de
// scolarité is the other document, which attests a current enrollment.
// ---------------------------------------------------------------------------

export type TransferCertificateData = {
  student: { firstName: string; lastName: string; matricule: string; gender: "F" | "M"; birthDate: Date; birthPlace: string | null };
  photo: PdfPhoto | null;
  origin: { name: string; commune: string };
  classroom: string;
  level: string;
  yearLabel: string;
  enrolledSince: Date;
  leftOn: Date;
  destination: { name: string; commune: string; department: string };
  destinationClassroom: string | null;
  reason: string;
  shareHistory: boolean;
  director: { name: string; gender: "F" | "M" | null } | null;
};

function TransferCertificate({ data, meta }: { data: TransferCertificateData; meta: DocumentMeta }) {
  const s = data.student;
  const she = s.gender === "F";
  const line = { fontSize: 11.5, lineHeight: 1.7 };
  const head = data.director;
  const headTitle = head?.gender === "F" ? "La directrice" : head?.gender === "M" ? "Le directeur" : "Le chef d'établissement";
  return (
    <DocumentPage meta={meta}>
      <View style={{ marginTop: 22, paddingHorizontal: 18 }}>
        <T style={[line]}>
          {head ? (
            <>
              <T style={{ fontWeight: 700 }}>{head.name}</T>, {head.gender === "F" ? "directrice" : head.gender === "M" ? "directeur" : "chef"} de l&apos;établissement{" "}
              <T style={{ fontWeight: 700 }}>{data.origin.name}</T> ({data.origin.commune}), certifie que :
            </>
          ) : (
            <>
              Le chef de l&apos;établissement <T style={{ fontWeight: 700 }}>{data.origin.name}</T> ({data.origin.commune}) certifie que :
            </>
          )}
        </T>
        <View
          style={{ marginVertical: 16, marginHorizontal: 24, paddingVertical: 12, paddingHorizontal: 16, borderLeftWidth: 3, borderLeftColor: COLORS.primary, backgroundColor: COLORS.soft, flexDirection: "row", gap: 14, alignItems: "center" }}
        >
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
          a été régulièrement {she ? "inscrite" : "inscrit"} dans notre établissement du {calendarDate(data.enrolledSince)} au {calendarDate(data.leftOn)}, en dernier lieu en classe
          de <T style={{ fontWeight: 700 }}>{data.classroom}</T> ({data.level}), année scolaire <T style={{ fontWeight: 700 }}>{data.yearLabel}</T>.
        </T>
        <T style={[line, { marginTop: 8 }]}>
          {she ? "Elle" : "Il"} quitte l&apos;établissement, libre de tout engagement, pour poursuivre sa scolarité à{" "}
          <T style={{ fontWeight: 700 }}>{data.destination.name}</T> ({data.destination.commune}, {data.destination.department})
          {data.destinationClassroom ? `, en ${data.destinationClassroom}` : ""}, avec l&apos;accord de ses parents.
        </T>
        <View style={{ marginTop: 12 }}>
          <InfoGrid
            columns={2}
            items={[
              { label: "Motif du départ", value: data.reason },
              { label: "Dossier scolaire", value: data.shareHistory ? "Transmis à l'établissement d'accueil" : "Non transmis, à la demande de la famille" },
            ]}
          />
        </View>
        <T style={[line, { marginTop: 12 }]}>En foi de quoi, le présent certificat lui est délivré pour servir et valoir ce que de droit.</T>
        <View style={{ marginTop: 22, alignItems: "flex-end" }} wrap={false}>
          <T style={{ fontSize: 11 }}>
            Fait à {data.origin.commune}, le {beninDate(meta.generatedAt)}
          </T>
          <View style={{ width: 230, marginTop: 4 }}>
            <Signatures items={[{ role: headTitle, name: head?.name ?? null, stamp: true }]} />
          </View>
        </View>
      </View>
      <View style={{ position: "absolute", bottom: 78, left: 58, right: 58 }}>
        <T style={[styles.small, styles.muted, { textAlign: "center" }]}>
          Certificat de radiation (exeat) délivré à la suite d&apos;un transfert accepté dans Classéo. Aucun frais ne peut être exigé pour un transfert. Toute rature
          ou surcharge le rend nul. Référence {meta.reference}.
        </T>
      </View>
    </DocumentPage>
  );
}

export const transferCertificatePdf = (data: TransferCertificateData, meta: DocumentMeta) => (
  <PdfDocument title={`Certificat de radiation, ${data.student.lastName} ${data.student.firstName}`} author={meta.issuer.name}>
    <TransferCertificate data={data} meta={meta} />
  </PdfDocument>
);
