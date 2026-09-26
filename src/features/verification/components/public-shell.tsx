import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/brand/logo";
import { FlagStripe } from "@/components/brand/flag";
import { Button } from "@/components/ui/button";
import { AnalyticsSlot } from "@/features/analytics/analytics-slot";

// Frame of the public check pages: reachable without an account, from the
// QR code printed on any document.
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <FlagStripe className="shrink-0" />
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-5">
        <Link href="/" aria-label="Classéo, accueil">
          <Logo />
        </Link>
        <p className="text-right text-xs font-bold tracking-[0.12em] text-muted uppercase">République du Bénin</p>
      </header>
      <main id="page-content" className="mx-auto w-full max-w-2xl flex-1 px-4 pb-12">
        {children}
      </main>
      <AnalyticsSlot />
    </div>
  );
}

export function CodeSearch({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form action="/verifier" method="get" className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <label htmlFor="verify-code" className="text-sm font-semibold text-text">
          Code de vérification
        </label>
        <input
          id="verify-code"
          name="code"
          defaultValue={defaultValue}
          required
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="K7QD4-M2XPH"
          aria-describedby="verify-code-hint"
          className="ds-field font-mono tracking-wider uppercase"
        />
        <p id="verify-code-hint" className="text-hint text-muted">
          Il figure en bas de chaque page du document, à côté du QR code.
        </p>
      </div>
      <Button type="submit" className="sm:mb-6">
        Vérifier
      </Button>
    </form>
  );
}
