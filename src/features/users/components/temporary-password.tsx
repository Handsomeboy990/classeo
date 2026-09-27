"use client";

import { Check, Copy, Mail, MailX } from "lucide-react";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export type MailStatus = "sent" | "skipped" | "failed";

export type IssuedPassword = { username: string; email?: string | null; password: string; mail?: MailStatus };

const MAIL_LINE: Record<MailStatus, string> = {
  sent: "Ces informations ont aussi été envoyées à l'adresse e-mail du compte.",
  skipped: "Aucun e-mail envoyé : le compte n'a pas d'adresse, ou l'envoi n'est pas configuré. Transmettez ces informations vous-même.",
  failed: "L'e-mail n'a pas pu être envoyé. Transmettez ces informations vous-même.",
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <Button type="button" variant="ghost" size="sm" onClick={copy} aria-label={label}>
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {copied ? "Copié" : "Copier"}
    </Button>
  );
}

// Shown once, right after the server generated it. It is not stored in clear
// anywhere and cannot be displayed again. The identifier comes first: it is
// what the person types to sign in, e-mail or not.
export function TemporaryPassword({ username, email, password, mail, onDone }: IssuedPassword & { onDone: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Alert tone="warning" title="Mot de passe temporaire, affiché une seule fois">
        Transmettez l&apos;identifiant et le mot de passe à la personne, en main propre ou par téléphone. Elle devra choisir son propre mot de passe à sa première connexion.
      </Alert>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 text-sm">
        <dt className="text-muted">Identifiant</dt>
        <dd className="flex flex-wrap items-center gap-2">
          <code className="rounded-control bg-primary-soft px-2 py-1 font-mono text-base font-semibold break-all" data-testid="issued-username">
            {username}
          </code>
          <CopyButton value={username} label="Copier l'identifiant" />
        </dd>
        <dt className="text-muted">Mot de passe</dt>
        <dd className="flex flex-wrap items-center gap-2">
          <code className="rounded-control bg-surface-2 px-2 py-1 font-mono text-base tracking-wider" data-testid="temporary-password">
            {password}
          </code>
          <CopyButton value={password} label="Copier le mot de passe" />
        </dd>
        {email && (
          <>
            <dt className="text-muted">E-mail</dt>
            <dd className="break-all">{email}</dd>
          </>
        )}
      </dl>
      {mail && (
        <p className="flex items-start gap-2 text-sm text-muted" data-testid="mail-status" data-status={mail}>
          {mail === "sent" ? <Mail className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <MailX className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />}
          <span>{MAIL_LINE[mail]}</span>
        </p>
      )}
      <div className="ds-dialog-actions">
        <Button type="button" onClick={onDone}>
          J&apos;ai transmis ces informations
        </Button>
      </div>
    </div>
  );
}
