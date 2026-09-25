import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AuthShell } from "@/features/auth/auth-shell";
import { RESET_CODE_MINUTES, RESET_EMAIL_COOKIE } from "@/features/auth/reset-code";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default async function ResetCodePage() {
  if (await getCurrentUser()) redirect("/espace");
  // Only used to prefill the field: the server checks the code against the
  // address submitted with it.
  const remembered = (await cookies()).get(RESET_EMAIL_COOKIE)?.value ?? "";
  const email = remembered.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(remembered) ? remembered : "";
  return (
    <AuthShell title="Nouveau mot de passe" description="Saisissez le code reçu par e-mail, puis choisissez votre nouveau mot de passe.">
      <ResetPasswordForm email={email} minutes={RESET_CODE_MINUTES} />
    </AuthShell>
  );
}
