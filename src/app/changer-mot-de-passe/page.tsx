import type { Metadata } from "next";

import { FlagStripe } from "@/components/brand/flag";
import { IndependenceNotice } from "@/components/brand/independence-notice";
import { loadBrand } from "@/components/brand/load-brand";
import { BrandLockup } from "@/components/brand/lockup";
import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { changePassword } from "@/features/auth/actions";
import { requireUser } from "@/lib/auth/session";
import { NO_INDEX } from "@/lib/seo";

export const metadata: Metadata = { title: "Changer le mot de passe", robots: NO_INDEX };

export default async function ChangePasswordPage() {
  const user = await requireUser();
  const brand = await loadBrand();
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <FlagStripe className="h-1 shrink-0" />
      <main id="page-content" tabIndex={-1} className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10 outline-none">
        <div className="w-full max-w-[28rem] rounded-card border border-border bg-surface p-6 shadow-raised sm:p-8">
          <BrandLockup brand={brand} tone="light" size="auth" />
          <h1 className="mt-6 text-[1.5rem] leading-tight font-bold lg:text-[1.75rem]">Changer le mot de passe</h1>
          {user.mustChangePassword && (
            <Alert tone="info" className="mt-4">
              Mot de passe temporaire : choisissez votre propre mot de passe pour continuer.
            </Alert>
          )}
          <p className="mt-4 text-sm text-muted">
            Votre identifiant de connexion :{" "}
            <code className="rounded-md bg-primary-soft px-2 py-0.5 font-mono text-base font-semibold text-text" data-testid="own-username">
              {user.username}
            </code>
            . Notez-le : il vous servira à chaque connexion.
          </p>
          <ActionForm action={changePassword} successToast={false} className="mt-6 flex flex-col gap-4">
            <FormField label="Mot de passe actuel" name="current" required>
              <Input type="password" autoComplete="current-password" />
            </FormField>
            <FormField label="Nouveau mot de passe" name="password" hint="10 caractères minimum, avec au moins une lettre et un chiffre." required>
              <Input type="password" autoComplete="new-password" />
            </FormField>
            <FormField label="Confirmer le nouveau mot de passe" name="confirm" required>
              <Input type="password" autoComplete="new-password" />
            </FormField>
            <SubmitButton size="lg" className="w-full">
              Enregistrer
            </SubmitButton>
          </ActionForm>
        </div>
        <IndependenceNotice brand={brand} className="max-w-[28rem]" />
      </main>
    </div>
  );
}
