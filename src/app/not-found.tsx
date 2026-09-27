import type { Metadata } from "next";
import { connection } from "next/server";

import { StatusPage } from "@/components/kit/status-page";
import { ButtonLink } from "@/components/ui/button";
import { FrenchPublicPage } from "@/features/public-pages/public-frame";

export const metadata: Metadata = { title: "Page introuvable" };

// Any address outside the space that matches no page: the public frame (the
// space has its own page, inside the shell). The two actions of part 4.13:
// back to the home page first, then the help guide (it asks a signed out
// visitor to sign in first, as the 403 page does). Rendered per request, so
// its scripts carry the nonce of the strict CSP.
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
            <ButtonLink href="/espace/aide" variant="secondary" size="lg">
              Aide
            </ButtonLink>
          </>
        }
      >
        <p>Le lien est peut-être incomplet, ou la page a été déplacée. Vérifiez l&apos;adresse, ou repartez de l&apos;accueil.</p>
      </StatusPage>
    </FrenchPublicPage>
  );
}
