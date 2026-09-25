import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { AuthShell } from "@/features/auth/auth-shell";
import { EmailCodeRequestForm } from "@/features/auth/email-code-request-form";
import { getCurrentUser } from "@/lib/auth/session";
import { mailEnabled } from "@/lib/mail";

export const metadata: Metadata = { title: "Code par e-mail" };

export default async function EmailCodePage() {
  if (await getCurrentUser()) redirect("/espace");
  return (
    <AuthShell title="Recevoir un code par e-mail" description="Pour les comptes qui ont une adresse e-mail. Un code vous y sera envoyé pour choisir un nouveau mot de passe.">
      {!mailEnabled && (
        <Alert tone="warning" title="Envoi d'e-mails non configuré" className="mb-6">
          Ce serveur n&apos;envoie pas d&apos;e-mails : le code ne vous parviendra pas. Demandez plutôt de l&apos;aide à votre établissement ou à votre administration.
        </Alert>
      )}
      <EmailCodeRequestForm />
    </AuthShell>
  );
}
