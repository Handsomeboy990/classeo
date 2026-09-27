import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { AuthShell } from "@/features/auth/auth-shell";
import { EmailCodeRequestForm } from "@/features/auth/email-code-request-form";
import { publicTranslator } from "@/features/public-pages/server";
import { PUBLIC } from "@/features/public-pages/texts";
import { publicChoice } from "@/features/public-pages/translate";
import { getCurrentUser } from "@/lib/auth/session";
import { mailEnabled } from "@/lib/mail";
import { NO_INDEX } from "@/lib/seo";

export const metadata: Metadata = { title: "Code par e-mail", robots: NO_INDEX };

// The frame follows the language of the page; the form, used by the few
// accounts with an e-mail address, is written in French only.
export default async function EmailCodePage({ searchParams }: PageProps<"/mot-de-passe-oublie/email">) {
  if (await getCurrentUser()) redirect("/espace");
  const { lang, voice } = publicChoice(await searchParams);
  const tr = await publicTranslator(lang);
  return (
    <AuthShell tr={tr} voice={voice} aside="code" title={PUBLIC.code.emailTitle} description={PUBLIC.code.emailDescription}>
      <div lang="fr">
      {!mailEnabled && (
        <Alert tone="warning" title="Envoi d'e-mails non configuré" className="mb-6">
          Ce serveur n&apos;envoie pas d&apos;e-mails : le code ne vous parviendra pas. Demandez plutôt de l&apos;aide à votre établissement ou à votre administration.
        </Alert>
      )}
      <EmailCodeRequestForm />
      </div>
    </AuthShell>
  );
}
