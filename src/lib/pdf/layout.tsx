import { Children, type ReactNode } from "react";

import { Document, G, Image, Page, Path, Rect, Svg, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { qrPath } from "@/lib/qr";

import { useVerification, type PdfImage } from "./context";
import { FONT_TITLE } from "./fonts";
import { beninDate, beninDateTime, pageLabel, pdfText } from "./format";
import { contactLine, ministriesFor, REPUBLIC, type SchoolCycleCode } from "./letterhead";
import { COLORS, PAGE, styles } from "./theme";

type StyleProp = Style | Style[];

// Text whose strings go through pdfText(), so no figure ever prints a glyph
// the embedded fonts lack.
function clean(node: ReactNode): ReactNode {
  if (typeof node === "string") return pdfText(node);
  if (Array.isArray(node)) return Children.map(node, clean);
  return node;
}

export function T({ children, style, ...rest }: { children?: ReactNode; style?: StyleProp; wrap?: boolean; minPresenceAhead?: number; orphans?: number; widows?: number }) {
  return (
    <Text style={style} {...rest}>
      {clean(children)}
    </Text>
  );
}

// Who issues the document: a school (bulletins, receipts, lists) or a level
// of the ministry (territorial statistics). Written as text: no emblem.
// The letterhead details (cycle, postal box, logo) are filled in by
// completeIssuer() from the school code before rendering.
export type Issuer =
  | {
      kind: "school";
      name: string;
      address?: string | null;
      place?: string | null;
      phone?: string | null;
      email?: string | null;
      code?: string | null;
      cycle?: SchoolCycleCode | null;
      postalBox?: string | null;
      // Bytes for the PDF (PNG or JPEG only), address for the HTML views.
      logo?: PdfImage | null;
      logoUrl?: string | null;
    }
  | { kind: "ministry"; name: string; detail?: string | null };

export type DocumentMeta = {
  title: string;
  subtitle?: string | null;
  reference: string;
  generatedAt: Date;
  generatedBy: { name: string; role: string; email: string };
  issuer: Issuer;
};

// The Classéo mark, drawn from the same paths as the application logo: an
// open book with the rising sun, in the colours of the flag.
export function Mark({ size = 34 }: { size?: number }) {
  return (
    <Svg viewBox="0 0 64 64" width={size} height={size}>
      <Rect x={0} y={0} width={64} height={64} rx={14} ry={14} fill={COLORS.primary} />
      <Path d="M20 37a12 12 0 0 1 24 0z" fill={COLORS.yellow} />
      <G stroke={COLORS.yellow} strokeWidth={3} strokeLinecap="round">
        <Path d="M32 14v5" />
        <Path d="M17.5 20l3.5 3.5" />
        <Path d="M46.5 20L43 23.5" />
      </G>
      <Path d="M8 38c8-4 16-4 24 2v14c-8-6-16-6-24-2z" fill={COLORS.white} />
      <Path d="M56 38c-8-4-16-4-24 2v14c8-6 16-6 24-2z" fill="#F0F1EA" />
      <Path d="M30.5 40h3v17l-1.5-2-1.5 2z" fill={COLORS.red} />
    </Svg>
  );
}

// A thin band in the three flag colours along the top edge of every page.
function FlagBand() {
  return (
    <View fixed style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, flexDirection: "row" }}>
      <View style={{ flex: 5, backgroundColor: COLORS.primary }} />
      <View style={{ flex: 2, backgroundColor: COLORS.yellow }} />
      <View style={{ flex: 2, backgroundColor: COLORS.red }} />
    </View>
  );
}

// Letterhead: the Republic and the ministry in words (no emblem), then the
// school with its logo and details, or the territorial service.
function IssuerBlock({ issuer }: { issuer: Issuer }) {
  const ministries = ministriesFor(issuer.kind === "school" ? issuer.cycle : null);
  return (
    <View style={{ maxWidth: 270 }}>
      <T style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1.2, color: COLORS.primaryDark, textTransform: "uppercase" }}>{REPUBLIC}</T>
      {ministries.map((m) => (
        <T key={m} style={{ fontSize: 7.5, fontWeight: 600, marginTop: 1.5, lineHeight: 1.25 }}>
          {m}
        </T>
      ))}
      <View style={{ width: 36, height: 1, backgroundColor: COLORS.primary, marginVertical: 4 }} />
      {issuer.kind === "ministry" ? (
        <View>
          <T style={{ fontSize: 10, fontWeight: 700 }}>{issuer.name}</T>
          {issuer.detail ? <T style={[styles.small, styles.muted]}>{issuer.detail}</T> : null}
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: 7, alignItems: "flex-start" }}>
          {issuer.logo ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={issuer.logo} style={{ width: 34, height: 34, objectFit: "contain" }} />
          ) : null}
          <View style={{ flexShrink: 1 }}>
            <T style={{ fontSize: 10.5, fontWeight: 700 }}>{issuer.name}</T>
            {issuer.address || issuer.place ? <T style={[styles.small, styles.muted]}>{[issuer.address, issuer.place].filter(Boolean).join(", ")}</T> : null}
            {contactLine(issuer) ? <T style={[styles.small, styles.muted]}>{contactLine(issuer)}</T> : null}
          </View>
        </View>
      )}
    </View>
  );
}

// Full header, on the first page of a document.
export function DocumentHeader({ meta, children }: { meta: DocumentMeta; children?: ReactNode }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 10, borderBottomWidth: 1.5, borderBottomColor: COLORS.primary }}>
        <View style={{ maxWidth: "56%" }}>
          <IssuerBlock issuer={meta.issuer} />
        </View>
        <View style={{ alignItems: "flex-end", maxWidth: "45%" }}>
          <T style={[styles.title, { textAlign: "right" }]}>{meta.title}</T>
          {meta.subtitle ? <T style={{ fontSize: 10, fontWeight: 600, marginTop: 3, textAlign: "right" }}>{meta.subtitle}</T> : null}
          <View style={{ marginTop: 6, flexDirection: "row", gap: 4, alignItems: "baseline" }}>
            <T style={styles.label}>Réf.</T>
            <T style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 0.4 }}>{meta.reference}</T>
          </View>
          <T style={[styles.small, styles.muted]}>Édité le {beninDate(meta.generatedAt)}</T>
        </View>
      </View>
      {children}
    </View>
  );
}

// Compact header repeated from the second page of a document on.
function RunningHeader({ meta }: { meta: DocumentMeta }) {
  return (
    <Text
      fixed
      style={{ position: "absolute", top: 16, left: PAGE.marginX, right: PAGE.marginX, fontSize: 7.5, color: COLORS.muted }}
      render={({ subPageNumber }) => (subPageNumber > 1 ? pdfText(`Classéo · ${meta.issuer.name} · ${meta.title}${meta.subtitle ? `, ${meta.subtitle}` : ""} · Réf. ${meta.reference}`) : "")}
    />
  );
}

// The QR code of the verification address, drawn as vector paths so it
// stays sharp at any print resolution.
export function QrCode({ matrix, size }: { matrix: NonNullable<ReturnType<typeof useVerification>>["qr"]; size: number }) {
  const { d, viewBox } = qrPath(matrix, 2);
  return (
    <Svg viewBox={`0 0 ${viewBox} ${viewBox}`} width={size} height={size}>
      <Rect x={0} y={0} width={viewBox} height={viewBox} fill={COLORS.white} />
      <Path d={d} fill={COLORS.text} />
    </Svg>
  );
}

// The footer text is static; the page number is a sibling of its own, the
// form the paginator repeats reliably on every page. When the document is
// registered, the QR code and the verification code sit at its left.
function Footer({ meta, pageHeight }: { meta: DocumentMeta; pageHeight: number }) {
  const by = meta.generatedBy;
  const check = useVerification();
  const qrSize = 44;
  return (
    <>
      <View
        fixed
        style={{ position: "absolute", bottom: 12, left: PAGE.marginX, right: PAGE.marginX, borderTopWidth: 0.75, borderTopColor: COLORS.border, paddingTop: 4, paddingRight: 70, flexDirection: "row", gap: 7, alignItems: "center" }}
      >
        {check ? <QrCode matrix={check.qr} size={qrSize} /> : null}
        <View style={{ flex: 1 }}>
          {check ? (
            <T style={{ fontSize: 7.5, fontWeight: 700, color: COLORS.primaryDark }}>
              Code de vérification {check.code} · {check.shortUrl}
            </T>
          ) : null}
          <T style={{ fontSize: 7, color: COLORS.muted }}>
            Généré sur Classéo le {beninDateTime(meta.generatedAt)} (heure du Bénin) par {by.name}, {by.role}.
          </T>
          <T style={{ fontSize: 7, color: COLORS.muted }}>
            {check ? "Scannez le code ou saisissez l'adresse pour vérifier l'authenticité de ce document." : `Vérification : réf. ${meta.reference} · compte ${by.email} · inscrit au journal d'activité de la plateforme.`}
          </T>
        </View>
      </View>
      <Text
        fixed
        style={{ position: "absolute", top: pageHeight - 40, right: PAGE.marginX, width: 70, textAlign: "right", fontSize: 8, fontWeight: 700, color: COLORS.primaryDark }}
        render={({ subPageNumber, subPageTotalPages }) => pageLabel(subPageNumber, subPageTotalPages)}
      />
      <View fixed style={{ position: "absolute", top: pageHeight - 27, right: PAGE.marginX, flexDirection: "row", gap: 3, alignItems: "center" }}>
        <Mark size={9} />
        <Text style={{ fontFamily: FONT_TITLE, fontWeight: 700, fontSize: 7, color: COLORS.primaryDark }}>Classéo</Text>
      </View>
    </>
  );
}

// One logical document: the flag band, the running header and the footer
// on every page, the full header at the top of the first one.
export function DocumentPage({
  meta,
  orientation = "portrait",
  header,
  children,
  style,
}: {
  meta: DocumentMeta;
  orientation?: "portrait" | "landscape";
  header?: ReactNode;
  children: ReactNode;
  style?: Style;
}) {
  return (
    <Page size="A4" orientation={orientation} style={style ? [styles.page, style] : styles.page} wrap>
      <FlagBand />
      <RunningHeader meta={meta} />
      <DocumentHeader meta={meta}>{header}</DocumentHeader>
      {children}
      <Footer meta={meta} pageHeight={orientation === "portrait" ? 841.89 : 595.28} />
    </Page>
  );
}

export function PdfDocument({ title, author, children }: { title: string; author: string; children: ReactNode }) {
  return (
    <Document title={pdfText(title)} author={pdfText(author)} creator="Classéo" producer="Classéo" language="fr-FR">
      {children}
    </Document>
  );
}
