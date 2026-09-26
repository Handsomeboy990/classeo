import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AuthShell } from "@/features/auth/auth-shell";
import { RESET_CODE_MINUTES, RESET_EMAIL_COOKIE } from "@/features/auth/reset-code";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";
import { publicTranslator } from "@/features/public-pages/server";
import { PUBLIC } from "@/features/public-pages/texts";
import { publicChoice } from "@/features/public-pages/translate";
import { getCurrentUser } from "@/lib/auth/session";
import { mailEnabled } from "@/lib/mail";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

// The frame follows the language of the page; the form is in French only.
export default async function ResetCodePage({ searchParams }: PageProps<"/mot-de-passe-oublie/code">) {
  if (await getCurrentUser()) redirect("/espace");
  const { lang, voice } = publicChoice(await searchParams);
  const tr = await publicTranslator(lang);
  // Only used to prefill the field: the server checks the code against the
  // address submitted with it.
  const remembered = (await cookies()).get(RESET_EMAIL_COOKIE)?.value ?? "";
  const email = remembered.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(remembered) ? remembered : "";
  return (
    <AuthShell tr={tr} voice={voice} aside="code" title={PUBLIC.code.resetTitle} description={PUBLIC.code.resetDescription}>
      <div lang="fr">
        <ResetPasswordForm email={email} minutes={RESET_CODE_MINUTES} mailEnabled={mailEnabled} />
      </div>
    </AuthShell>
  );
}
