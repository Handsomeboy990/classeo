import type { Metadata } from "next";
import { connection } from "next/server";

import { BackButton, StatusPage } from "@/components/kit/status-page";
import { ButtonLink } from "@/components/ui/button";
import { FrenchPublicPage } from "@/features/public-pages/public-frame";

export const metadata: Metadata = { title: "Page introuvable" };

// Any address that matches no page, signed in or not: the public frame,
// outside the app shell (the space has its own page, inside the shell).
// Rendered per request, so its scripts carry the nonce of the strict CSP.
export default async function NotFound() {
  await connection();
  return (
    <FrenchPublicPage>
      <StatusPage
        code="404"
        title="Cette page est introuvable"
        actions={
          <>
            <ButtonLink href="/" size="lg">
              Retour à l&apos;accueil
            </ButtonLink>
            <ButtonLink href="/espace" variant="secondary" size="lg">
              Aller à mon espace
            </ButtonLink>
          </>
        }
        footer={<BackButton fallback="/" variant="link" />}
      >
        <p>Le lien est peut-être incomplet, ou la page a été déplacée. Vérifiez l&apos;adresse, ou repartez de l&apos;accueil.</p>
      </StatusPage>
    </FrenchPublicPage>
  );
}
