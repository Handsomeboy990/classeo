import { BackButton, StatusPage } from "@/components/kit/status-page";
import { ButtonLink } from "@/components/ui/button";
import { FrenchPublicPage } from "@/features/public-pages/public-frame";

// Rendered by forbidden() outside the space (an API or a page of its own),
// in the public frame; the pages of the space have theirs, inside the shell.
export default function Forbidden() {
  return (
    <FrenchPublicPage>
      <StatusPage
        code="403"
        title="Accès refusé"
        actions={
          <>
            <ButtonLink href="/espace" size="lg">
              Retour à mon espace
            </ButtonLink>
            <ButtonLink href="/espace/aide" variant="secondary" size="lg">
              Aide
            </ButtonLink>
          </>
        }
        footer={<BackButton fallback="/espace" variant="link" />}
      >
        <p>Votre rôle ne donne pas accès à cette page. Si vous en avez besoin, demandez-le à la personne qui gère votre compte.</p>
      </StatusPage>
    </FrenchPublicPage>
  );
}
