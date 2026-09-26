import { ImageResponse } from "next/og";

import { roundedMark } from "@/features/pwa/brand-art";

export const alt = "Classéo, toute l'école au même endroit";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Share card: deep green field, the rising sun on the horizon, the flag
// stripe at the bottom. System font only, nothing to download.
export default function OpenGraphImage() {
  const rays = Array.from({ length: 11 }, (_, i) => -75 + i * 15);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0b3b2a", color: "#e7efe9", position: "relative" }}>
        <svg width="520" height="273" viewBox="0 0 400 210" style={{ position: "absolute", right: -30, bottom: 14 }}>
          {rays.map((deg) => {
            const r = (deg * Math.PI) / 180;
            return (
              <line
                key={deg}
                x1={200 + Math.sin(r) * 128}
                y1={205 - Math.cos(r) * 128}
                x2={200 + Math.sin(r) * 168}
                y2={205 - Math.cos(r) * 168}
                stroke="#fcd116"
                strokeWidth="7"
                strokeLinecap="round"
              />
            );
          })}
          <path d="M95 205a105 105 0 0 1 210 0z" fill="#fcd116" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", padding: "64px 72px", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <img src={roundedMark} width={84} height={84} />
            <span style={{ fontSize: 52, fontWeight: 800, color: "#ffffff" }}>Classéo</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 56, fontSize: 70, fontWeight: 800, lineHeight: 1.05, color: "#ffffff", maxWidth: 760 }}>
            <span>Toute l&apos;école,</span>
            <span style={{ color: "#fcd116" }}>au même endroit.</span>
          </div>
          <span style={{ marginTop: 28, fontSize: 28, color: "#a9c2b4", maxWidth: 560 }}>Gestion scolaire pour le Bénin · Voix Kora · Hors ligne</span>
        </div>
        <div style={{ display: "flex", height: 14 }}>
          <div style={{ width: "40%", background: "#008751" }} />
          <div style={{ width: "40%", background: "#fcd116" }} />
          <div style={{ width: "20%", background: "#e8112d" }} />
        </div>
      </div>
    ),
    size,
  );
}
