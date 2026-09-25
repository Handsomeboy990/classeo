"use client";

import { ArrowLeft, KeyRound, LogIn } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { resetPasswordWithCode } from "./reset-actions";

// mailEnabled: whether this server sends e-mail at all. Without it, no page
// may say that a code or a confirmation was sent.
export function ResetPasswordForm({ email, minutes, mailEnabled }: { email: string; minutes: number; mailEnabled: boolean }) {
  const [done, setDone] = useState<{ mailSent: boolean } | null>(null);

  if (done)
    return (
      <div className="flex flex-col gap-5" role="status">
        <Alert tone="success" title="Mot de passe modifié">
          Toutes les sessions ouvertes avec ce compte ont été fermées.
          {done.mailSent ? " Une confirmation a été envoyée à l'adresse du compte." : ""}
        </Alert>
        <ButtonLink href="/connexion" size="lg" className="w-full">
          <LogIn aria-hidden /> Se connecter
        </ButtonLink>
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      {!mailEnabled ? (
        <Alert tone="warning" title="Aucun e-mail ne peut être envoyé">
          L&apos;envoi d&apos;e-mails n&apos;est pas configuré sur ce serveur : aucun code n&apos;a été envoyé. Demandez à votre administrateur de réinitialiser votre mot de
          passe depuis « Comptes utilisateurs ».
        </Alert>
      ) : (
        email && (
          <Alert tone="info">
            Si un compte actif correspond à cette adresse, un code à 6 chiffres vient d&apos;y être envoyé. Il est valable {minutes} minutes. Vérifiez aussi les
            courriers indésirables.
          </Alert>
        )
      )}
      <ActionForm
        action={resetPasswordWithCode}
        successToast={false}
        onSuccess={(state) => setDone({ mailSent: (state?.data as { mailSent?: boolean } | undefined)?.mailSent === true })}
        className="flex flex-col gap-4"
      >
        <FormField label="Adresse e-mail du compte" name="email" required>
          <Input type="email" autoComplete="username" inputMode="email" defaultValue={email} maxLength={200} />
        </FormField>
        <FormField label="Code reçu par e-mail" name="code" required hint="6 chiffres. Après 5 essais incorrects, demandez un nouveau code.">
          <Input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={9}
            placeholder="000000"
            className="font-mono text-lg tracking-[0.3em]"
          />
        </FormField>
        <FormField label="Nouveau mot de passe" name="password" required hint="10 caractères minimum, avec au moins une lettre et un chiffre.">
          <Input type="password" autoComplete="new-password" maxLength={200} />
        </FormField>
        <FormField label="Confirmer le nouveau mot de passe" name="confirm" required>
          <Input type="password" autoComplete="new-password" maxLength={200} />
        </FormField>
        <SubmitButton size="lg" pendingLabel="Vérification…" className="mt-2 w-full">
          <KeyRound aria-hidden /> Changer le mot de passe
        </SubmitButton>
      </ActionForm>
      <div className="flex flex-col gap-2 text-sm">
        <Link href="/mot-de-passe-oublie" className="font-semibold text-primary underline-offset-4 hover:underline">
          Recevoir un nouveau code
        </Link>
        <Link href="/connexion" className="inline-flex items-center gap-1.5 text-muted hover:text-text">
          <ArrowLeft className="size-4" aria-hidden /> Retour à la connexion
        </Link>
      </div>
    </div>
  );
}
