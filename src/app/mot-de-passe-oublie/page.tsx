import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/features/auth/auth-shell";
import { PasswordHelpForm } from "@/features/password-help/request-form";
import { publicTranslator } from "@/features/public-pages/server";
import { PUBLIC, PUBLIC_SPEECH } from "@/features/public-pages/texts";
import { choiceQuery, publicChoice } from "@/features/public-pages/translate";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default async function ForgotPasswordPage({ searchParams }: PageProps<"/mot-de-passe-oublie">) {
  if (await getCurrentUser()) redirect("/espace");
  const { lang, voice } = publicChoice(await searchParams);
  const tr = await publicTranslator(lang);
  return (
    <AuthShell tr={tr} voice={voice} aside="help" title={PUBLIC.help.title} description={PUBLIC.help.description} listen={PUBLIC_SPEECH.help}>
      <PasswordHelpForm query={choiceQuery(lang, voice)} />
    </AuthShell>
  );
}
