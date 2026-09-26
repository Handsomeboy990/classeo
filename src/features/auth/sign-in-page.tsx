import { AuthShell } from "@/features/auth/auth-shell";
import { LoginForm, type DemoPanel } from "@/features/auth/login-form";
import { publicTranslator } from "@/features/public-pages/server";
import { PUBLIC, PUBLIC_SPEECH } from "@/features/public-pages/texts";
import { publicChoice, withChoice } from "@/features/public-pages/translate";
import { param } from "@/lib/list";

// The sign in page, in French, Fongbe or Yoruba (?lang=, ?voix=), shared by
// the public /connexion and the secret demo address /acces/<token>. See
// AuthShell for the frame and LoginForm for the form. demo is null when the
// page shows no demonstration panel.
export async function SignInPage({ searchParams, demo }: { searchParams: Record<string, string | string[] | undefined>; demo: DemoPanel | null }) {
  const { lang, voice } = publicChoice(searchParams);
  const tr = await publicTranslator(lang);
  const next = param(searchParams, "next");

  return (
    <AuthShell tr={tr} voice={voice} aside="signin" title={PUBLIC.signIn.title} description={PUBLIC.signIn.intro} descriptionAs="info" listen={PUBLIC_SPEECH.signIn} extra={{ next }}>
      <LoginForm next={next} demo={demo} forgotHref={withChoice("/mot-de-passe-oublie", lang, voice)} />
    </AuthShell>
  );
}
