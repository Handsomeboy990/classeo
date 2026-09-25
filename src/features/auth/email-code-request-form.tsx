"use client";

import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { Input } from "@/components/ui/input";

import { requestPasswordReset } from "./reset-actions";

// The alternative for accounts that have an e-mail address: a code sent to
// it. Accounts without one ask their school instead (/mot-de-passe-oublie).
export function EmailCodeRequestForm() {
  return (
    <div className="flex flex-col gap-6">
      <ActionForm action={requestPasswordReset} successToast={false} className="flex flex-col gap-4">
        <FormField label="Adresse e-mail du compte" name="email" required hint="L'adresse enregistrée sur votre compte.">
          <Input type="email" autoComplete="email" inputMode="email" placeholder="prenom.nom@exemple.bj" maxLength={200} />
        </FormField>
        <SubmitButton size="lg" pendingLabel="Envoi…" className="mt-2 w-full">
          <Send aria-hidden /> Recevoir un code
        </SubmitButton>
      </ActionForm>
      <div className="flex flex-col gap-2 text-sm">
        <Link href="/mot-de-passe-oublie/code" className="font-semibold text-primary underline-offset-4 hover:underline">
          J&apos;ai déjà reçu un code
        </Link>
        <Link href="/mot-de-passe-oublie" className="font-semibold text-primary underline-offset-4 hover:underline">
          Pas d&apos;adresse e-mail ? Demander de l&apos;aide à mon école
        </Link>
        <Link href="/connexion" className="inline-flex items-center gap-1.5 text-muted hover:text-text">
          <ArrowLeft className="size-4" aria-hidden /> Retour à la connexion
        </Link>
      </div>
    </div>
  );
}
