import type { ReactNode } from "react";

import { Image, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { useSigned } from "./context";
import { FONT_TITLE } from "./fonts";
import { beninDateTime } from "./format";
import { T } from "./layout";
import { COLORS, styles } from "./theme";

export type Column<R> = {
  header: string;
  // Relative width (flex grow) or fixed width in points.
  flex?: number;
  width?: number;
  align?: "left" | "right" | "center";
  render: (row: R, index: number) => ReactNode;
};

function cellBox<R>(c: Column<R>): Style {
  return c.width ? { width: c.width } : { flex: c.flex ?? 1 };
}

function alignOf(align: Column<unknown>["align"]): Style {
  return align === "right" ? styles.num : align === "center" ? styles.center : {};
}

// A table whose header repeats on every page it spans and whose rows never
// break across two pages.
export function DataTable<R>({
  columns,
  rows,
  footer,
  zebra = true,
  rowHeight,
  fontSize,
  dense = false,
  empty = "Aucune ligne.",
}: {
  columns: Column<R>[];
  rows: R[];
  footer?: ReactNode[];
  zebra?: boolean;
  rowHeight?: number;
  fontSize?: number;
  dense?: boolean;
  empty?: string;
}) {
  return (
    <View style={styles.table}>
      <View style={styles.headRow} fixed>
        {columns.map((c, i) => (
          <View key={i} style={cellBox(c)}>
            <T style={[styles.headCell, alignOf(c.align)]}>{c.header}</T>
          </View>
        ))}
      </View>
      {rows.length === 0 ? (
        <View style={styles.row} wrap={false}>
          <T style={[styles.cell, styles.muted, { flex: 1 }]}>{empty}</T>
        </View>
      ) : null}
      {rows.map((row, r) => (
        <View
          key={r}
          wrap={false}
          // The last row keeps the total line company on its page.
          minPresenceAhead={footer && r === rows.length - 1 ? 22 : undefined}
          style={[styles.row, zebra && r % 2 === 1 ? { backgroundColor: COLORS.zebra } : {}, rowHeight ? { minHeight: rowHeight } : {}]}
        >
          {columns.map((c, i) => {
            const content = c.render(row, r);
            return (
              <View key={i} style={[cellBox(c), { justifyContent: "center" }]}>
                {typeof content === "string" || typeof content === "number" ? (
                  <T style={[styles.cell, alignOf(c.align), fontSize ? { fontSize } : {}, dense ? { paddingVertical: 2 } : {}]}>{String(content)}</T>
                ) : (
                  <View style={{ paddingVertical: dense ? 2 : 3.5, paddingHorizontal: 5 }}>{content}</View>
                )}
              </View>
            );
          })}
        </View>
      ))}
      {footer ? (
        <View style={styles.footRow} wrap={false}>
          {columns.map((c, i) => (
            <View key={i} style={cellBox(c)}>
              {typeof footer[i] === "string" ? <T style={[styles.cell, alignOf(c.align), { fontWeight: 700 }]}>{footer[i] as string}</T> : (footer[i] ?? null)}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// Label and value pairs laid out in a framed grid.
export function InfoGrid({ items, columns = 4 }: { items: { label: string; value: ReactNode }[]; columns?: number }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", borderWidth: 0.75, borderColor: COLORS.border, borderRadius: 4, paddingVertical: 6, paddingHorizontal: 4 }}>
      {items.map((it, i) => (
        <View key={i} style={{ width: `${100 / columns}%`, paddingHorizontal: 6, paddingVertical: 4 }}>
          <T style={styles.label}>{it.label}</T>
          {typeof it.value === "string" ? <T style={[styles.value, { marginTop: 1 }]}>{it.value}</T> : it.value}
        </View>
      ))}
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return (
    <T style={styles.h2} minPresenceAhead={60}>
      {children}
    </T>
  );
}

// Key figure, for summaries (general average, amount received, totals).
export function Figure({
  label,
  value,
  hint,
  tone = "plain",
  big = false,
  compact = false,
}: {
  label: string;
  value: string;
  hint?: string | null;
  tone?: "plain" | "primary" | "warning" | "danger";
  big?: boolean;
  compact?: boolean;
}) {
  const bg = tone === "primary" ? COLORS.primarySoft : tone === "warning" ? COLORS.warningSoft : tone === "danger" ? COLORS.dangerSoft : COLORS.white;
  const border = tone === "primary" ? COLORS.primary : tone === "warning" ? COLORS.warning : tone === "danger" ? COLORS.danger : COLORS.border;
  return (
    <View style={{ flex: 1, backgroundColor: bg, borderWidth: 0.75, borderColor: border, borderRadius: 4, paddingVertical: compact ? 5 : 7, paddingHorizontal: compact ? 7 : 9 }}>
      <T style={styles.label}>{label}</T>
      <View style={{ height: big ? 26 : compact ? 17 : 19, justifyContent: "center", marginTop: 1 }}>
        <T style={{ fontFamily: FONT_TITLE, fontWeight: 700, fontSize: big ? 20 : 14, lineHeight: 1, color: COLORS.primaryDark }}>{value}</T>
      </View>
      {hint ? <T style={[styles.small, styles.muted]}>{hint}</T> : null}
    </View>
  );
}

export function FigureRow({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }} wrap={false}>
      {children}
    </View>
  );
}

// A framed notice (preview, cancelled invoice...).
export function Notice({ tone = "warning", title, children }: { tone?: "warning" | "info" | "danger"; title: string; children?: ReactNode }) {
  const bg = tone === "danger" ? COLORS.dangerSoft : tone === "info" ? COLORS.primarySoft : COLORS.warningSoft;
  const fg = tone === "danger" ? COLORS.danger : tone === "info" ? COLORS.primaryDark : COLORS.warning;
  return (
    <View style={{ backgroundColor: bg, borderLeftWidth: 3, borderLeftColor: fg, paddingVertical: 5, paddingHorizontal: 8, marginBottom: 10 }} wrap={false}>
      <T style={{ fontWeight: 700, color: fg, fontSize: 9 }}>{title}</T>
      {children ? <T style={{ fontSize: 8.5, marginTop: 1 }}>{children}</T> : null}
    </View>
  );
}

// Signature boxes at the end of a document. In a document signed
// electronically, the first box with a stamp (the head's) shows the signer's
// signature and stamp images and the date of signature.
export function Signatures({ items, marginTop = 18 }: { items: { role: string; name?: string | null; stamp?: boolean }[]; marginTop?: number }) {
  const signed = useSigned();
  const signedIndex = signed ? items.findIndex((s) => s.stamp) : -1;
  return (
    <View style={{ flexDirection: "row", gap: 16, marginTop }} wrap={false}>
      {items.map((s, i) => {
        const e = i === signedIndex ? signed : null;
        return (
          <View key={i} style={{ flex: 1 }}>
            <T style={styles.label}>{s.role}</T>
            <T style={{ fontSize: 9.5, fontWeight: 600, marginTop: 2, minHeight: 12 }}>{e ? e.name : (s.name ?? "")}</T>
            {e ? (
              <View style={{ marginTop: 4, height: 70, position: "relative", borderWidth: 0.75, borderColor: COLORS.primary, borderRadius: 4, padding: 4, justifyContent: "flex-end" }}>
                {e.stamp ? (
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <Image src={e.stamp} style={{ position: "absolute", right: 6, top: 3, width: 62, height: 62, objectFit: "contain", opacity: 0.9 }} />
                ) : null}
                {e.signature ? (
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <Image src={e.signature} style={{ position: "absolute", left: 6, top: 6, width: 120, height: 44, objectFit: "contain" }} />
                ) : null}
                <T style={{ fontSize: 6.5, color: COLORS.primaryDark, fontWeight: 600 }}>Signé électroniquement le {beninDateTime(e.signedAt)}</T>
              </View>
            ) : (
              <View
                style={{
                  marginTop: 4,
                  height: s.stamp ? 58 : 44,
                  borderWidth: 0.75,
                  borderColor: COLORS.border,
                  borderStyle: "dashed",
                  borderRadius: 4,
                  justifyContent: "flex-end",
                  padding: 4,
                }}
              >
                <T style={{ fontSize: 6.5, color: COLORS.faint }}>{s.stamp ? "Signature et cachet" : "Signature"}</T>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// A mention in a pill, for statuses.
export function Pill({ children, tone = "neutral" }: { children: string; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const map = {
    neutral: [COLORS.soft, COLORS.muted],
    success: [COLORS.primarySoft, COLORS.primaryDark],
    warning: [COLORS.warningSoft, COLORS.warning],
    danger: [COLORS.dangerSoft, COLORS.danger],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <T style={{ fontSize: 7.5, fontWeight: 700, color: fg, backgroundColor: bg, paddingVertical: 1.5, paddingHorizontal: 5, borderRadius: 6, alignSelf: "flex-start" }}>
      {children}
    </T>
  );
}
