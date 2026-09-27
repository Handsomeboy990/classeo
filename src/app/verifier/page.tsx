import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CodeSearch, PublicShell } from "@/features/verification/components/public-shell";
import { normalizeCode } from "@/features/verification/reference";
import { param } from "@/lib/list";

export const metadata: Metadata = { title: "Vérifier un document", robots: { index: false } };

// Entry of the public check: a code typed from paper.
export default async function VerifyHomePage({ searchParams }: PageProps<"/verifier">) {
  const sp = await searchParams;
  const typed = param(sp, "code") ?? "";
  const code = typed ? normalizeCode(typed) : null;
  if (code) redirect(`/verifier/${code}`);

  return (
    <PublicShell>
      <p className="font-display text-[0.6875rem] font-bold tracking-[0.08em] text-primary uppercase">Contrôle d&apos;authenticité, sans compte</p>
      <h1 className="mt-2 text-[1.5rem] leading-tight font-bold lg:text-[1.75rem]">Vérifier un document</h1>
      <p className="mt-3 mb-6 max-w-2xl leading-relaxed text-muted">
        Bulletins, attestations, certificats, reçus et factures délivrés sur Classéo portent un code de vérification et un QR code. Scannez le QR code, ou saisissez le
        code ci-dessous.
      </p>
      {typed && !code && (
        <p role="alert" className="mb-4 rounded-control bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">
          Ce code n&apos;a pas la bonne forme : il compte 10 caractères, par exemple K7QD4-M2XPH.
        </p>
      )}
      <div className="rounded-card border border-border bg-surface p-5 shadow-xs sm:p-6">
        <CodeSearch defaultValue={typed} />
      </div>
    </PublicShell>
  );
}
