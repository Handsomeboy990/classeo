// Colours of the printed documents, the one place of the PDF and print code
// that writes them. Pure: shared by the PDF documents and the HTML print
// views (server components), no renderer import here.

// Print palette (design source of truth, part 4.14): the light tokens of
// the design system, tuned for paper. The institutional navy carries the
// structure; green, yellow and red only appear in the flag band, the
// tricolour rule and the mark, never behind text.
export const COLORS = {
  text: "#0F1B2D",
  muted: "#475569",
  faint: "#6B778C",
  border: "#C9D3E0",
  rule: "#DCE3EC",
  zebra: "#F4F6FA",
  soft: "#EDF1F7",
  primary: "#0A3764",
  primaryDark: "#072747",
  primarySoft: "#E8EEF6",
  green: "#008751",
  yellow: "#FCD116",
  yellowSoft: "#FFF6CC",
  red: "#E8112D",
  danger: "#C8102E",
  dangerSoft: "#FDE8EB",
  warning: "#8A5A00",
  warningSoft: "#FFF1D1",
  info: "#1B5FB0",
  success: "#006B40",
  successSoft: "#E3F1E9",
  white: "#FFFFFF",
} as const;

// A4 in points and the margins of every document.
export const PAGE = {
  marginX: 40,
  marginTop: 44,
  marginBottom: 62,
} as const;

// Tints for subjects in the timetables, light enough for any printer, each
// with a darker edge (text on the tint stays above 4.5:1).
export const SUBJECT_TINTS = [
  ["#E8EEF6", "#0A3764"],
  ["#E3F1E9", "#006B40"],
  ["#FFF1D1", "#8A5A00"],
  ["#FDE8EB", "#C8102E"],
  ["#E0F4F4", "#0F6B6B"],
  ["#EFE7FB", "#6B3FB3"],
  ["#EEF2DC", "#5B6B12"],
  ["#ECEEF2", "#3F4A5A"],
] as const;
