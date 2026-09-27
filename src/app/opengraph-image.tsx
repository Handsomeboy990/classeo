import { ImageResponse } from "next/og";

import { bareMark } from "@/features/pwa/brand-art";

export const alt = "Classéo, le système éducatif à portée de main";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Share card in the official grammar: the navy field of the header bar, the
// mark and the name over a thin tricolour rule, the slogan, the independence
// notice, and the flag band in three equal thirds at the bottom. System font
// only, nothing to download.
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0a3764", color: "#ffffff" }}>
        <div style={{ display: "flex", height: 40, background: "#072747", alignItems: "center", padding: "0 72px", fontSize: 20, color: "#c9d3e0" }}>
          Plateforme de gestion scolaire pour les établissements du Bénin
        </div>
        <div style={{ display: "flex", flexDirection: "column", padding: "56px 72px 0", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <img src={bareMark} width={96} height={96} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 50, fontWeight: 800, letterSpacing: 2, lineHeight: 1 }}>CLASSÉO</span>
              <div style={{ display: "flex", width: 236, height: 5 }}>
                <div style={{ flex: 1, background: "#008751" }} />
                <div style={{ flex: 1, background: "#fcd116" }} />
                <div style={{ flex: 1, background: "#e8112d" }} />
              </div>
              <span style={{ fontSize: 18, letterSpacing: 3, color: "#c9d3e0" }}>GESTION SCOLAIRE · BÉNIN</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 52, fontSize: 68, fontWeight: 800, lineHeight: 1.08 }}>
            <span>Le système éducatif,</span>
            <span style={{ color: "#fcd116" }}>à portée de main.</span>
          </div>
          <span style={{ marginTop: 26, fontSize: 26, color: "#c9d3e0" }}>Inscriptions, notes, bulletins, présences, frais et messages.</span>
          <span style={{ marginTop: "auto", marginBottom: 26, fontSize: 18, color: "#a9b8cc" }}>
            Plateforme indépendante, non officielle. Non affiliée au Gouvernement du Bénin.
          </span>
        </div>
        <div style={{ display: "flex", height: 14 }}>
          <div style={{ flex: 1, background: "#008751" }} />
          <div style={{ flex: 1, background: "#fcd116" }} />
          <div style={{ flex: 1, background: "#e8112d" }} />
        </div>
      </div>
    ),
    size,
  );
}
