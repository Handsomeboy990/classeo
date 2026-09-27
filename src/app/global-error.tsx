"use client";

import "./globals.css";

// Last resort, when the root layout itself fails: its own document, no
// component that could fail in turn, and none of the fonts the layout loads
// (the fallback stack below). The one file with its colours written out
// (design source of truth, 4.13), so that it shows even without the tokens:
// the navy bar, the tricolour rule, the light page, the independence notice.
const NAVY = "#0a3764";
const BAND = "#072747";
const TEXT = "#0f1b2d";
const MUTED = "#475569";
const PAGE = "#f4f6fa";
const FONT = "Montserrat, 'Atkinson Hyperlegible Next', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="fr" style={{ colorScheme: "light" }}>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          background: PAGE,
          color: TEXT,
          fontFamily: FONT,
        }}
      >
        <title>Classéo n&apos;a pas pu s&apos;afficher</title>
        <header style={{ background: NAVY, color: "#ffffff" }}>
          <div
            style={{
              maxWidth: "80rem",
              margin: "0 auto",
              padding: "0 20px",
              height: 64,
              display: "flex",
              alignItems: "center",
            }}
          >
            {/* A full page load on purpose: the root layout has just failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                color: "#ffffff",
                fontWeight: 800,
                fontSize: 20,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                textDecoration: "none",
              }}
            >
              Classéo
            </a>
          </div>
          <FlagRule height={4} />
        </header>
        <main
          id="page-content"
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 20px",
          }}
        >
          <div
            style={{
              maxWidth: "28rem",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div style={{ width: 64 }}>
              <FlagRule height={4} />
            </div>
            <h1
              style={{
                margin: "24px 0 0",
                fontSize: 26,
                lineHeight: 1.25,
                fontWeight: 700,
              }}
            >
              Classéo n&apos;a pas pu s&apos;afficher
            </h1>
            <p style={{ margin: "12px 0 0", color: MUTED, lineHeight: 1.5 }}>Vérifiez votre connexion, puis réessayez dans un instant.</p>
            <button
              type="button"
              onClick={retry}
              style={{
                marginTop: 32,
                minHeight: 48,
                padding: "0 24px",
                border: 0,
                borderRadius: 6,
                background: NAVY,
                color: "#ffffff",
                font: `600 16px ${FONT}`,
                cursor: "pointer",
              }}
            >
              Réessayer
            </button>
            {error.digest && <p style={{ margin: "24px 0 0", fontSize: 14, color: MUTED }}>Référence : {error.digest}</p>}
          </div>
        </main>
        <footer
          style={{
            background: BAND,
            color: "#a9b8cc",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          <p style={{ maxWidth: "80rem", margin: "0 auto", padding: "20px" }}>Plateforme indépendante, non officielle. Non affiliée au Gouvernement du Bénin.</p>
          <FlagRule height={6} />
        </footer>
      </body>
    </html>
  );
}

function FlagRule({ height }: { height: number }) {
  return (
    <div aria-hidden style={{ display: "flex", height }}>
      <span style={{ flex: 1, background: "#008751" }} />
      <span style={{ flex: 1, background: "#fcd116" }} />
      <span style={{ flex: 1, background: "#e8112d" }} />
    </div>
  );
}
