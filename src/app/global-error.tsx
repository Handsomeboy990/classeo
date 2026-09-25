"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui", padding: 32, textAlign: "center" }}>
        <h1>Une erreur est survenue</h1>
        <p>Vérifiez votre connexion puis réessayez.</p>
        <button type="button" onClick={reset} style={{ padding: "10px 16px", marginTop: 12 }}>
          Réessayer
        </button>
      </body>
    </html>
  );
}
