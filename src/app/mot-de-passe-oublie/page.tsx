import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/features/auth/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default async function ForgotPasswordPage() {
  if (await getCurrentUser()) redirect("/espace");
  return (
    <AuthShell
      title="Mot de passe oublié"
      description="Saisissez l'adresse e-mail de votre compte : nous vous enverrons un code pour choisir un nouveau mot de passe."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
