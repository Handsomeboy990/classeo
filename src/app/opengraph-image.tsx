import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { bareMark } from "@/features/pwa/brand-art";

export const alt = "Classéo, plateforme de gestion scolaire";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Share card in the official grammar, with the product lockup of decision
// D5: the mark, then "RÉPUBLIQUE DU BÉNIN" as a small overline over a thin
// tricolour rule, "Classéo" in sentence case and "Plateforme de gestion
// scolaire", on the navy field of the header bar. Then the slogan, the
// independence notice and the flag band in three equal thirds at the
// bottom. Montserrat for the lockup and the slogan, Atkinson Hyperlegible
// Next for the text, from the files the PDFs embed: nothing downloaded.
export default async function OpenGraphImage() {
  const [semiBold, extraBold, text] = await Promise.all([
    readFile(join(process.cwd(), "src/lib/pdf/fonts/Montserrat-SemiBold.ttf")),
    readFile(join(process.cwd(), "src/lib/pdf/fonts/Montserrat-ExtraBold.ttf")),
    readFile(join(process.cwd(), "src/lib/pdf/fonts/AtkinsonHyperlegibleNext-Regular.ttf")),
  ]);
  const muted = "#c9d3e0";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0a3764", color: "#ffffff", fontFamily: "Atkinson" }}>
        <div style={{ display: "flex", flexDirection: "column", padding: "64px 72px 0", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <img src={bareMark} width={104} height={104} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", flexDirection: "column", alignSelf: "flex-start", gap: 7 }}>
                <span style={{ fontFamily: "Montserrat", fontWeight: 600, fontSize: 19, letterSpacing: 3, color: muted }}>RÉPUBLIQUE DU BÉNIN</span>
                <div style={{ display: "flex", height: 4 }}>
                  <div style={{ flex: 1, background: "#008751" }} />
                  <div style={{ flex: 1, background: "#fcd116" }} />
                  <div style={{ flex: 1, background: "#e8112d" }} />
                </div>
              </div>
              <span style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 56, lineHeight: 1, marginTop: 12 }}>Classéo</span>
              <span style={{ fontFamily: "Montserrat", fontWeight: 600, fontSize: 24, color: muted, marginTop: 8 }}>Plateforme de gestion scolaire</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 56, fontFamily: "Montserrat", fontSize: 64, fontWeight: 800, lineHeight: 1.1 }}>
            <span>Le système éducatif,</span>
            <span style={{ color: "#fcd116" }}>à portée de main.</span>
          </div>
          <span style={{ marginTop: 24, fontSize: 28, color: muted }}>Inscriptions, notes, bulletins, présences, frais et messages.</span>
          <span style={{ marginTop: "auto", marginBottom: 28, fontSize: 20, color: "#a9b8cc" }}>Plateforme indépendante, non officielle. Non affiliée au Gouvernement du Bénin.</span>
        </div>
        <div style={{ display: "flex", height: 14 }}>
          <div style={{ flex: 1, background: "#008751" }} />
          <div style={{ flex: 1, background: "#fcd116" }} />
          <div style={{ flex: 1, background: "#e8112d" }} />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Montserrat", data: semiBold, weight: 600, style: "normal" },
        { name: "Montserrat", data: extraBold, weight: 800, style: "normal" },
        { name: "Atkinson", data: text, weight: 400, style: "normal" },
      ],
    },
  );
}
