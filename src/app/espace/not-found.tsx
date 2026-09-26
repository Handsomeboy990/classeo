import { Compass } from "lucide-react";

import { BackButton, StatusPage } from "@/components/kit/status-page";
import { ButtonLink } from "@/components/ui/button";

// A record that does not exist or is outside the account's scope (notFound()
// in a page of the space): inside the shell, the menu stays at hand.
export default function SpaceNotFound() {
  return (
    <StatusPage
      code="404"
      icon={<Compass />}
      title="Cette page est introuvable"
      actions={
        <>
          <BackButton fallback="/espace" />
          <ButtonLink href="/espace" size="lg">
            Retour au tableau de bord
          </ButtonLink>
        </>
      }
    >
      <p>Elle n&apos;existe pas, ou elle n&apos;est pas accessible avec votre compte.</p>
    </StatusPage>
  );
}
