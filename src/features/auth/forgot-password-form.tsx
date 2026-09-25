"use client";

import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { Input } from "@/components/ui/input";

import { requestPasswordReset } from "./reset-actions";

export function ForgotPasswordForm() {
  return (
    <div className="flex flex-col gap-6">
      <ActionForm action={requestPasswordReset} successToast={false} className="flex flex-col gap-4">
        <FormField label="Adresse e-mail du compte" name="email" required hint="L'adresse qui vous sert d'identifiant de connexion.">
          <Input type="email" autoComplete="username" inputMode="email" placeholder="prenom.nom@exemple.bj" maxLength={200} />
        </FormField>
        <SubmitButton size="lg" pendingLabel="Envoi…" className="mt-2 w-full">
          <Send aria-hidden /> Recevoir un code
        </SubmitButton>
      </ActionForm>
      <div className="flex flex-col gap-2 text-sm">
        <Link href="/mot-de-passe-oublie/code" className="font-semibold text-primary underline-offset-4 hover:underline">
          J&apos;ai déjà reçu un code
        </Link>
        <Link href="/connexion" className="inline-flex items-center gap-1.5 text-muted hover:text-text">
          <ArrowLeft className="size-4" aria-hidden /> Retour à la connexion
        </Link>
      </div>
    </div>
  );
}
