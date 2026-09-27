import { Home, LifeBuoy, ShieldX } from "lucide-react";

import { StatusPage } from "@/components/kit/status-page";
import { ButtonLink } from "@/components/ui/button";

// Rendered by forbidden() in a page of the space: the account is signed in
// but its role does not cover this page. Inside the shell, the menu stays at
// hand.
export default function SpaceForbidden() {
  return (
    <StatusPage
      code="403"
      icon={<ShieldX />}
      tone="warning"
      title="Accès refusé"
      actions={
        <>
          <ButtonLink href="/espace/aide" variant="secondary" size="lg">
            <LifeBuoy aria-hidden /> Aide
          </ButtonLink>
          <ButtonLink href="/espace" size="lg">
            <Home aria-hidden /> Retour à l&apos;accueil
          </ButtonLink>
        </>
      }
    >
      <p>Votre rôle ne donne pas accès à cette page. Si vous en avez besoin, demandez-le à la personne qui gère votre compte.</p>
    </StatusPage>
  );
}
