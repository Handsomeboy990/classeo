import { StyleSheet } from "@react-pdf/renderer";

import { FONT_TEXT, FONT_TITLE } from "./fonts";
import { COLORS, PAGE } from "./theme";

// Shared styles of the PDF documents: page, titles, labels and tables.
// Titles and table headings in Montserrat, text in Atkinson Hyperlegible
// Next (design source of truth, part 4.14).
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
  headCell: { paddingVertical: 4.5, paddingHorizontal: 5, fontFamily: FONT_TITLE, fontSize: 7.2, fontWeight: 700, letterSpacing: 0.3, color: COLORS.primaryDark, textTransform: "uppercase" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COLORS.rule },
  cell: { paddingVertical: 4, paddingHorizontal: 5, fontSize: 9 },
  footRow: { flexDirection: "row", backgroundColor: COLORS.soft, borderTopWidth: 1, borderTopColor: COLORS.primary },
  num: { textAlign: "right" },
  center: { textAlign: "center" },
});
