import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Font } from "@react-pdf/renderer";

// Brand fonts embedded in every PDF (SIL Open Font License 1.1, licences next
// to the files, no reserved font name): Montserrat for titles, the typeface
// of the official sites, and Atkinson Hyperlegible Next for text. The
// TrueType files are subsets of the @fontsource packages pinned in
// devDependencies, unpacked from WOFF once: latin for both, plus the latin
// extended subset of Montserrat as a fallback family, so a title carrying a
// letter of the national languages (ɔ, ɛ...) still prints it. They live in
// src/lib/pdf/fonts so the server never downloads a font; each path is a literal joined to process.cwd(), the form
// the output file tracing follows, so the files ship with the standalone and
// serverless bundles.

export const FONT_TEXT = "Atkinson";
const TITLE = "Montserrat";
const TITLE_EXT = "MontserratExt";
// Every style names both title families: the renderer takes each glyph
// from the first one that has it.
export const FONT_TITLE: string[] = [TITLE, TITLE_EXT];

function dataUrl(file: string) {
  return `data:font/ttf;base64,${readFileSync(file).toString("base64")}`;
}

function register() {
  // The font store lives in the PDF package, shared by every route of the
  // process: register once per process, not once per route bundle.
  if (Font.getRegisteredFontFamilies().includes(FONT_TEXT)) return;
  Font.register({
    family: FONT_TEXT,
    fonts: [
      { src: dataUrl(join(process.cwd(), "src/lib/pdf/fonts/AtkinsonHyperlegibleNext-Regular.ttf")), fontWeight: 400 },
      { src: dataUrl(join(process.cwd(), "src/lib/pdf/fonts/AtkinsonHyperlegibleNext-Italic.ttf")), fontWeight: 400, fontStyle: "italic" },
      { src: dataUrl(join(process.cwd(), "src/lib/pdf/fonts/AtkinsonHyperlegibleNext-SemiBold.ttf")), fontWeight: 600 },
      { src: dataUrl(join(process.cwd(), "src/lib/pdf/fonts/AtkinsonHyperlegibleNext-Bold.ttf")), fontWeight: 700 },
    ],
  });
  Font.register({
    family: TITLE,
    fonts: [
      { src: dataUrl(join(process.cwd(), "src/lib/pdf/fonts/Montserrat-SemiBold.ttf")), fontWeight: 600 },
      { src: dataUrl(join(process.cwd(), "src/lib/pdf/fonts/Montserrat-Bold.ttf")), fontWeight: 700 },
      { src: dataUrl(join(process.cwd(), "src/lib/pdf/fonts/Montserrat-ExtraBold.ttf")), fontWeight: 800 },
    ],
  });
  Font.register({
    family: TITLE_EXT,
    fonts: [
      { src: dataUrl(join(process.cwd(), "src/lib/pdf/fonts/Montserrat-SemiBold-LatinExt.ttf")), fontWeight: 600 },
      { src: dataUrl(join(process.cwd(), "src/lib/pdf/fonts/Montserrat-Bold-LatinExt.ttf")), fontWeight: 700 },
      { src: dataUrl(join(process.cwd(), "src/lib/pdf/fonts/Montserrat-ExtraBold-LatinExt.ttf")), fontWeight: 800 },
    ],
  });
  // French words are never cut with a hyphen the reader did not write.
  Font.registerHyphenationCallback((word) => [word]);
}

type Glyph = { codePoints?: number[] };
type LoadedFont = { getGlyph: (id: number, codePoints?: number[]) => Glyph | null; classeoGuard?: boolean };
type Source = { load: () => Promise<void>; data: LoadedFont | null };

// The font engine caches glyphs by id with the characters of their first
// request. Embedding a subset asks for accented letters' components (the E
// of É, the comma of a cedilla...) without characters, so the next document
// found those glyphs mapped to no character: they vanished from the text
// layer and shifted the neighbouring punctuation. The guard gives a cached
// glyph its characters back whenever a layout asks for it with them.
function guard(font: LoadedFont) {
  if (font.classeoGuard) return;
  const getGlyph = font.getGlyph.bind(font);
  font.getGlyph = (id, codePoints = []) => {
    const glyph = getGlyph(id, codePoints);
    if (glyph && codePoints.length && !glyph.codePoints?.length) glyph.codePoints = codePoints;
    return glyph;
  };
  font.classeoGuard = true;
}

// Registers and loads the brand fonts before a document is laid out.
export async function prepareFonts() {
  register();
  const families = Font.getRegisteredFonts() as unknown as Record<string, { sources: Source[] }>;
  for (const family of [FONT_TEXT, TITLE, TITLE_EXT]) {
    for (const source of families[family]?.sources ?? []) {
      await source.load();
      if (source.data) guard(source.data);
    }
  }
}
