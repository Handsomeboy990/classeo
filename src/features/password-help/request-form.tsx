"use client";

import { ArrowLeft, LifeBuoy, LogIn, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { requestPasswordHelp } from "./actions";

// Forgotten password without an e-mail address. The answer is the same for
// every identifier: the page never tells whether an account exists.
export function PasswordHelpForm() {
  const [sent, setSent] = useState(false);

  if (sent)
    return (
      <div className="flex flex-col gap-5">
        <Alert tone="success" title="Demande transmise">
          Si cet identifiant correspond à un compte actif, votre demande est arrivée chez la personne qui gère votre compte : le chef d&apos;établissement pour les élèves,
          les parents et le personnel ; la circonscription pour un chef d&apos;établissement ; puis la direction départementale et le ministère. Elle vous remettra un
          mot de passe temporaire, en personne ou au numéro indiqué.
        </Alert>
        <ButtonLink href="/connexion" size="lg" className="w-full">
          <LogIn aria-hidden /> Retour à la connexion
        </ButtonLink>
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      <ActionForm action={requestPasswordHelp} successToast={false} onSuccess={() => setSent(true)} className="flex flex-col gap-4">
        <FormField label="Identifiant" name="login" required hint="Votre prénom et votre nom séparés par un point, par exemple afiavi.hounkpatin.">
          <Input type="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="prenom.nom" maxLength={200} />
        </FormField>
        <FormField label="Téléphone pour vous rappeler" name="contact" hint="Facultatif. Le numéro où la personne qui vous aide peut vous joindre.">
          <Input type="tel" inputMode="tel" autoComplete="tel" maxLength={20} placeholder="01 97 00 00 00" />
        </FormField>
        <SubmitButton size="lg" pendingLabel="Envoi…" className="mt-2 w-full">
          <LifeBuoy aria-hidden /> Demander un nouveau mot de passe
        </SubmitButton>
      </ActionForm>
      <div className="flex flex-col gap-2 text-sm">
        <Link href="/mot-de-passe-oublie/email" className="inline-flex items-center gap-1.5 font-semibold text-primary underline-offset-4 hover:underline">
          <Mail className="size-4" aria-hidden /> Mon compte a une adresse e-mail : recevoir un code
        </Link>
        <Link href="/connexion" className="inline-flex items-center gap-1.5 text-muted hover:text-text">
          <ArrowLeft className="size-4" aria-hidden /> Retour à la connexion
        </Link>
      </div>
    </div>
  );
}
