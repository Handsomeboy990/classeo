import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/features/auth/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";
import { Alert } from "@/components/ui/alert";
import { getCurrentUser } from "@/lib/auth/session";
import { mailEnabled } from "@/lib/mail";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default async function ForgotPasswordPage() {
  if (await getCurrentUser()) redirect("/espace");
  return (
    <AuthShell
      title="Mot de passe oublié"
      description="Saisissez l'adresse e-mail de votre compte. Un code vous y sera envoyé pour choisir un nouveau mot de passe."
    >
      {!mailEnabled && (
        <Alert tone="warning" title="Envoi d'e-mails non configuré" className="mb-6">
          Ce serveur n&apos;envoie pas d&apos;e-mails : le code ne vous parviendra pas. Votre administrateur peut réinitialiser votre mot de passe depuis « Comptes
          utilisateurs ».
        </Alert>
      )}
      <ForgotPasswordForm />
    </AuthShell>
  );
}
