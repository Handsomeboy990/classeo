import { ShieldX } from "lucide-react";

import { BackButton, StatusPage } from "@/components/kit/status-page";
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
          <BackButton fallback="/espace" />
          <ButtonLink href="/espace" size="lg">
            Retour au tableau de bord
          </ButtonLink>
        </>
      }
    >
      <p>Votre rôle ne donne pas accès à cette page. Si vous en avez besoin, demandez-le à la personne qui gère votre compte.</p>
    </StatusPage>
  );
}
