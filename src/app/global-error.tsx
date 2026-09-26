"use client";

import "./globals.css";

// Last resort, when the root layout itself fails: its own document, the
// design tokens of globals.css, no component that could fail in turn.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body className="flex min-h-dvh items-center justify-center bg-bg px-5 text-text" style={{ fontFamily: "system-ui, sans-serif" }}>
        <main className="flex max-w-md flex-col items-center text-center">
          <span className="ds-flag-stripe h-1 w-16 rounded-full" aria-hidden />
          <h1 className="mt-6 text-2xl font-bold">Classéo n&apos;a pas pu s&apos;afficher</h1>
          <p className="mt-3 text-muted">Vérifiez votre connexion, puis réessayez dans un instant.</p>
          <button type="button" onClick={reset} className="mt-8 min-h-12 rounded-control bg-primary px-6 font-semibold text-on-primary hover:bg-primary-hover">
            Réessayer
          </button>
          {error.digest && <p className="mt-6 text-sm text-muted">Référence : {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
