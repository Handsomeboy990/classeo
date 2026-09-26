import type { Metadata } from "next";

import { Logo } from "@/components/brand/logo";
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
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Logo />
        <h1 className="mt-8 text-2xl font-bold">Changer le mot de passe</h1>
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
          <SubmitButton size="lg">Enregistrer</SubmitButton>
        </ActionForm>
      </div>
    </main>
  );
}
