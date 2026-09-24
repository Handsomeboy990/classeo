"use client";

import { Eye, EyeOff, LogIn } from "lucide-react";
import { useRef, useState } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { Input } from "@/components/ui/input";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo/accounts";

import { login } from "./actions";

export function LoginForm({ next, showDemo }: { next?: string; showDemo: boolean }) {
  const [visible, setVisible] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function fill(email: string) {
    if (emailRef.current) emailRef.current.value = email;
    if (passwordRef.current) passwordRef.current.value = DEMO_PASSWORD;
    passwordRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-8">
      <ActionForm action={login} successToast={false} className="flex flex-col gap-4">
        {next && <input type="hidden" name="next" value={next} />}
        <FormField label="Adresse e-mail" name="email" required>
          <Input ref={emailRef} type="email" autoComplete="username" inputMode="email" placeholder="prenom.nom@exemple.bj" />
        </FormField>
        <div className="relative">
          <FormField label="Mot de passe" name="password" required>
            <Input ref={passwordRef} type={visible ? "text" : "password"} autoComplete="current-password" className="pr-12" />
          </FormField>
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-2 bottom-1.5 rounded-md p-2 text-muted hover:text-text"
            aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            aria-pressed={visible}
          >
            {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
          </button>
        </div>
        <SubmitButton size="lg" pendingLabel="Connexion…" className="mt-2 w-full">
          <LogIn aria-hidden /> Se connecter
        </SubmitButton>
      </ActionForm>

      {showDemo && (
        <section aria-labelledby="demo-title" className="rounded-card border border-dashed border-border-strong bg-surface-2 p-4">
          <h2 id="demo-title" className="text-sm font-bold">
            Comptes de démonstration
          </h2>
          <p className="mt-1 text-xs text-muted">
            Choisissez un rôle pour remplir le formulaire. Mot de passe commun : <code className="font-semibold text-text">{DEMO_PASSWORD}</code>
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.email}>
                <button
                  type="button"
                  onClick={() => fill(a.email)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-left hover:border-primary"
                >
                  <span className="block text-sm font-semibold text-text">{a.role}</span>
                  <span className="block text-xs text-muted">{a.scope}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
