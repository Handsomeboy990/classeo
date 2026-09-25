import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/features/auth/auth-shell";
import { PasswordHelpForm } from "@/features/password-help/request-form";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default async function ForgotPasswordPage() {
  if (await getCurrentUser()) redirect("/espace");
  return (
    <AuthShell
      aside="help"
      title="Mot de passe oublié"
      description="Saisissez votre identifiant. Votre établissement ou votre administration recevra la demande et vous remettra un mot de passe temporaire."
    >
      <PasswordHelpForm />
    </AuthShell>
  );
}
