import { Compass } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BackButton, StatusPage } from "@/components/kit/status-page";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page introuvable" };

// Any address that matches no page, signed in or not: outside the app shell.
export default function NotFound() {
  return (
    <StatusPage
      standalone
      code="404"
      icon={<Compass />}
      title="Cette page est introuvable"
      actions={
        <>
          <BackButton fallback="/" />
          <ButtonLink href="/espace" size="lg">
            Aller à mon espace
          </ButtonLink>
        </>
      }
      footer={
        <Link href="/" className="font-semibold text-primary underline-offset-4 hover:underline">
          Accueil du site
        </Link>
      }
    >
      <p>Le lien est peut-être incomplet, ou la page a été déplacée. Vérifiez l&apos;adresse, ou repartez de votre espace.</p>
    </StatusPage>
  );
}
