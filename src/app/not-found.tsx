import { EmptyState } from "@/components/kit/states";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl py-16">
      <EmptyState
        title="Page introuvable"
        description="Cette page n'existe pas ou n'est pas accessible avec votre compte."
        action={<ButtonLink href="/espace">Retour à l&apos;accueil</ButtonLink>}
      />
    </main>
  );
}
