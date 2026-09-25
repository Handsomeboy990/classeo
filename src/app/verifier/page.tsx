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
      <h1 className="text-2xl font-bold sm:text-3xl">Vérifier un document</h1>
      <p className="mt-2 mb-6 text-muted">
        Bulletins, attestations, certificats, reçus et factures délivrés sur Classéo portent un code de vérification et un QR code. Scannez le QR code, ou saisissez le
        code ci-dessous.
      </p>
      {typed && !code && (
        <p role="alert" className="mb-4 rounded-control bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">
          Ce code n&apos;a pas la bonne forme : il compte 10 caractères, par exemple K7QD4-M2XPH.
        </p>
      )}
      <CodeSearch defaultValue={typed} />
    </PublicShell>
  );
}
