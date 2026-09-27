import { Compass } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { BackButton, StatusPage } from "@/components/kit/status-page";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page introuvable" };

// Any address that matches no page, signed in or not: outside the app shell.
// Rendered per request, so its scripts carry the nonce of the strict CSP.
export default async function NotFound() {
  await connection();
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
