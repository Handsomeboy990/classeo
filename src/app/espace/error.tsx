"use client";

import { CloudOff, LifeBuoy, RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { StatusPage } from "@/components/kit/status-page";
import { Button, ButtonLink } from "@/components/ui/button";

export default function SpaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div role="alert">
      <StatusPage
        icon={<CloudOff />}
        tone="danger"
        title="Cette page n'a pas pu s'afficher"
        actions={
          <>
            <ButtonLink href="/espace/aide" variant="secondary" size="lg">
              <LifeBuoy aria-hidden /> Aide
            </ButtonLink>
            <Button onClick={reset} size="lg">
              <RotateCcw aria-hidden /> Réessayer
            </Button>
          </>
        }
        footer={error.digest ? <>Référence à donner au support : <code className="font-semibold text-text">{error.digest}</code></> : undefined}
      >
        <p>Vérifiez votre connexion, puis réessayez. Si cela se reproduit, prévenez la personne qui gère votre compte.</p>
      </StatusPage>
    </div>
  );
}
