import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/features/auth/auth-shell";
import { LoginForm } from "@/features/auth/login-form";
import { publicTranslator } from "@/features/public-pages/server";
import { PUBLIC, PUBLIC_SPEECH } from "@/features/public-pages/texts";
import { publicChoice, withChoice } from "@/features/public-pages/translate";
import { getCurrentUser } from "@/lib/auth/session";
import { param } from "@/lib/list";

export const metadata: Metadata = { title: "Connexion" };

// Sign in, in French, Fongbe or Yoruba (?lang=, ?voix=). See AuthShell for
// the frame and LoginForm for the form.
export default async function LoginPage({ searchParams }: PageProps<"/connexion">) {
  if (await getCurrentUser()) redirect("/espace");
  const sp = await searchParams;
  const { lang, voice } = publicChoice(sp);
  const tr = await publicTranslator(lang);
  const next = param(sp, "next");
  const showDemo = process.env.DEMO_MODE !== "off";

  return (
    <AuthShell tr={tr} voice={voice} aside="signin" title={PUBLIC.signIn.title} description={PUBLIC.signIn.intro} listen={PUBLIC_SPEECH.signIn} extra={{ next }}>
      <LoginForm next={next} showDemo={showDemo} forgotHref={withChoice("/mot-de-passe-oublie", lang, voice)} />
    </AuthShell>
  );
}
