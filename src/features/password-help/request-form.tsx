"use client";

import { ArrowLeft, LifeBuoy, LogIn, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { useText } from "@/components/kit/text-provider";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PUBLIC } from "@/features/public-pages/texts";

import { requestPasswordHelp } from "./actions";

const H = PUBLIC.help;

// Forgotten password without an e-mail address. The answer is the same for
// every identifier: the page never tells whether an account exists. Texts
// in the language of the page (TextProvider); query carries that choice to
// the next page.
export function PasswordHelpForm({ query = "" }: { query?: string }) {
  const { t } = useText();
  const [sent, setSent] = useState(false);

  if (sent)
    return (
      <div className="flex flex-col gap-5">
        <Alert tone="success" title={t(H.sentTitle)}>
          {t(H.sentBody)}
        </Alert>
        <ButtonLink href={`/connexion${query}`} size="lg" className="w-full">
          <LogIn aria-hidden /> {t(H.backToSignIn)}
        </ButtonLink>
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      <ActionForm action={requestPasswordHelp} successToast={false} onSuccess={() => setSent(true)} className="flex flex-col gap-4">
        <FormField label={t(PUBLIC.signIn.identifier)} name="login" required hint={t(PUBLIC.signIn.identifierHint)}>
          <Input type="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="prenom.nom" maxLength={200} />
        </FormField>
        <FormField label={t(H.phone)} name="contact" hint={t(H.phoneHint)}>
          <Input type="tel" inputMode="tel" autoComplete="tel" maxLength={20} placeholder="01 97 00 00 00" />
        </FormField>
        <SubmitButton size="lg" pendingLabel={t(H.pending)} className="mt-2 w-full">
          <LifeBuoy aria-hidden /> {t(H.submit)}
        </SubmitButton>
      </ActionForm>
      <div className="flex flex-col gap-1 text-sm">
        <Link
          href={`/mot-de-passe-oublie/email${query}`}
          className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-primary underline-offset-4 hover:underline"
        >
          <Mail className="size-4 shrink-0" aria-hidden /> {t(H.byEmail)}
        </Link>
        <Link href={`/connexion${query}`} className="inline-flex min-h-11 items-center gap-1.5 text-muted hover:text-text">
          <ArrowLeft className="size-4 shrink-0" aria-hidden /> {t(H.backToSignIn)}
        </Link>
      </div>
    </div>
  );
}
