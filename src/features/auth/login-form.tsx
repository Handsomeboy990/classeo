"use client";

import { ChevronDown, CircleHelp, LogIn } from "lucide-react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { useRef } from "react";

import { ActionForm, FormMessage, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { useText } from "@/components/kit/text-provider";
import { Input } from "@/components/ui/input";
import type { ActionState } from "@/lib/action";
import { PUBLIC } from "@/features/public-pages/texts";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo/accounts";

import { login } from "./actions";
import { PasswordInput } from "./password-input";

const S = PUBLIC.signIn;

// A lost network must not end on an error page: the person keeps what they
// typed and reads what happened. A redirect (signed in) goes on as usual.
async function submit(prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    return await login(prev, formData);
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, message: S.offline };
  }
}

// Sign in with the identifier made of the person's names. Texts come from
// the public list (features/public-pages/texts.ts), shown in the language of
// the page; the refusal of the server is shown in the form, above the
// fields, and read out by screen readers.
export function LoginForm({ next, showDemo, forgotHref }: { next?: string; showDemo: boolean; forgotHref: string }) {
  const { t } = useText();
  const loginRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function fill(username: string) {
    if (loginRef.current) loginRef.current.value = username;
    if (passwordRef.current) passwordRef.current.value = DEMO_PASSWORD;
    passwordRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-6">
      <ActionForm action={submit} successToast={false} errorToast={false} className="flex flex-col gap-5">
        <FormMessage title={t(S.failed)} />
        {next && <input type="hidden" name="next" value={next} />}
        <div className="flex flex-col gap-1">
          <FormField label={t(S.identifier)} name="login" required hint={t(S.identifierHint)}>
            <Input
              ref={loginRef}
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              placeholder="prenom.nom"
              maxLength={200}
            />
          </FormField>
          <details className="group text-sm">
            <summary className="-ml-1 inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-md px-1 font-semibold text-primary [&::-webkit-details-marker]:hidden">
              <CircleHelp className="size-4 shrink-0" aria-hidden />
              {t(S.identifierHelp)}
              <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="mt-1 flex flex-col gap-1.5 rounded-control bg-surface-2 px-3.5 py-3 leading-relaxed text-text">
              <p>{t(S.identifierWhere)}</p>
              <p>{t(S.identifierTwin)}</p>
              <p>{t(S.identifierNoEmail)}</p>
            </div>
          </details>
        </div>
        <div className="flex flex-col gap-1">
          <FormField label={t(S.password)} name="password" required>
            <PasswordInput ref={passwordRef} autoComplete="current-password" enterKeyHint="go" maxLength={200} showLabel={t(S.showPassword)} hideLabel={t(S.hidePassword)} />
          </FormField>
          <Link href={forgotHref} className="-mr-1 inline-flex min-h-11 items-center self-end rounded-md px-1 text-sm font-semibold text-primary underline-offset-4 hover:underline">
            {t(S.forgot)}
          </Link>
        </div>
        <SubmitButton size="lg" pendingLabel={t(S.pending)} className="w-full">
          <LogIn aria-hidden /> {t(PUBLIC.common.signIn)}
        </SubmitButton>
      </ActionForm>

      {showDemo && (
        // Closed by default: the form comes first, the jury opens the list.
        // For the presentation only, in French.
        <details lang="fr" className="group rounded-card border border-border bg-surface-2">
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
