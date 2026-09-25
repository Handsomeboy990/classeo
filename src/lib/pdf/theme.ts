import { StyleSheet } from "@react-pdf/renderer";

import { FONT_TEXT, FONT_TITLE } from "./fonts";

// Print palette: the light tokens of the design system, tuned for paper.
// Green carries the structure, yellow and red only appear in the flag band
// and the mark, never behind text.
export const COLORS = {
  text: "#1a1d1a",
  muted: "#545a52",
  faint: "#7a8078",
  border: "#cfcec4",
  rule: "#dddcd3",
  zebra: "#f6f6f1",
  soft: "#f0f1ea",
  primary: "#006b40",
  primaryDark: "#0b3b2a",
  primarySoft: "#e3f1e9",
  yellow: "#fcd116",
  yellowSoft: "#fff6cc",
  red: "#e8112d",
  danger: "#b3102a",
  dangerSoft: "#fde8eb",
  warning: "#8a5a00",
  warningSoft: "#fff1d1",
  info: "#1d4ed8",
  white: "#ffffff",
} as const;

// A4 in points and the margins of every document.
export const PAGE = {
  marginX: 40,
  marginTop: 44,
  marginBottom: 62,
} as const;

export const styles = StyleSheet.create({
  page: {
    fontFamily: FONT_TEXT,
    fontSize: 9.5,
    lineHeight: 1.35,
    color: COLORS.text,
    paddingTop: PAGE.marginTop,
    paddingBottom: PAGE.marginBottom,
    paddingHorizontal: PAGE.marginX,
  },
  title: { fontFamily: FONT_TITLE, fontWeight: 700, fontSize: 19, lineHeight: 1.1, color: COLORS.primaryDark },
  h2: { fontFamily: FONT_TITLE, fontWeight: 700, fontSize: 11.5, color: COLORS.primaryDark, marginBottom: 6 },
  label: { fontSize: 7, fontWeight: 600, letterSpacing: 0.6, color: COLORS.muted, textTransform: "uppercase" },
  value: { fontSize: 10, fontWeight: 600 },
  muted: { color: COLORS.muted },
  small: { fontSize: 8 },
  section: { marginTop: 14 },
  // Tables
  table: { borderTopWidth: 1, borderTopColor: COLORS.primary, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headRow: { flexDirection: "row", backgroundColor: COLORS.primarySoft, borderBottomWidth: 1, borderBottomColor: COLORS.primary },
  headCell: { paddingVertical: 4.5, paddingHorizontal: 5, fontSize: 7.2, fontWeight: 700, letterSpacing: 0.3, color: COLORS.primaryDark, textTransform: "uppercase" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COLORS.rule },
  cell: { paddingVertical: 4, paddingHorizontal: 5, fontSize: 9 },
  footRow: { flexDirection: "row", backgroundColor: COLORS.soft, borderTopWidth: 1, borderTopColor: COLORS.primary },
  num: { textAlign: "right" },
  center: { textAlign: "center" },
});
