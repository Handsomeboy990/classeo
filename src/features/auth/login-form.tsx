"use client";

import { ChevronDown, Eye, EyeOff, LogIn } from "lucide-react";
import Link from "next/link";
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

  function fill(login: string) {
    if (emailRef.current) emailRef.current.value = login;
    if (passwordRef.current) passwordRef.current.value = DEMO_PASSWORD;
    passwordRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-6">
      <ActionForm action={login} successToast={false} className="flex flex-col gap-4">
        {next && <input type="hidden" name="next" value={next} />}
        <FormField label="Identifiant" name="login" required hint="Votre prénom et votre nom séparés par un point, par exemple afiavi.hounkpatin.">
          <Input ref={emailRef} type="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="prenom.nom" />
        </FormField>
        <div className="relative">
          <FormField label="Mot de passe" name="password" required>
            <Input ref={passwordRef} type={visible ? "text" : "password"} autoComplete="current-password" className="pr-12" />
          </FormField>
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute top-[1.625rem] right-0 inline-flex size-11 items-center justify-center rounded-md text-muted hover:text-text"
            aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            aria-pressed={visible}
          >
            {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
          </button>
        </div>
        <Link href="/mot-de-passe-oublie" className="-mt-1 self-end text-sm font-semibold text-primary underline-offset-4 hover:underline">
          Mot de passe oublié ?
        </Link>
        <SubmitButton size="lg" pendingLabel="Connexion…" className="mt-1 w-full">
          <LogIn aria-hidden /> Se connecter
        </SubmitButton>
      </ActionForm>

      {showDemo && (
        // Closed by default: the form comes first, the jury opens the list.
        <details className="group rounded-card border border-border bg-surface-2">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-2 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-text">Comptes de démonstration</span>
              <span className="block text-xs text-muted">Choisir un rôle remplit le formulaire.</span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="border-t border-border px-2 pt-2 pb-3">
            <p className="px-2 pb-2 text-xs text-muted">
              Mot de passe commun : <code className="font-semibold text-text">{DEMO_PASSWORD}</code>
            </p>
            <ul className="flex flex-col">
              {DEMO_ACCOUNTS.map((a) => (
                <li key={a.username}>
                  <button
                    type="button"
                    onClick={() => fill(a.username)}
                    className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-surface"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-text">{a.role}</span>
                      <span className="block truncate text-xs text-muted">{a.scope}</span>
                    </span>
                    <code className="shrink-0 text-xs text-muted max-[380px]:hidden">{a.username}</code>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </div>
  );
}
