import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { FrenchPublicPage } from "@/features/public-pages/public-frame";

// Frame of the public check pages, reachable without an account from the QR
// code printed on any document: the public header and footer around a
// column of the light page.
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <FrenchPublicPage current="verify">
      <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-6 lg:py-14">{children}</div>
    </FrenchPublicPage>
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
