import { ShieldX } from "lucide-react";

import { BackButton, StatusPage } from "@/components/kit/status-page";
import { ButtonLink } from "@/components/ui/button";

// Rendered by forbidden() outside the space (an API or a page of its own);
// the pages of the space have theirs, inside the shell.
export default function Forbidden() {
  return (
    <StatusPage
      standalone
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
