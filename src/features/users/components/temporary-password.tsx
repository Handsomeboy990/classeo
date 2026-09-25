"use client";

import { Check, Copy, Mail, MailX } from "lucide-react";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export type MailStatus = "sent" | "skipped" | "failed";

export type IssuedPassword = { email: string; password: string; mail?: MailStatus };

const MAIL_LINE: Record<MailStatus, string> = {
  sent: "Un e-mail contenant ces informations a été envoyé à cette adresse.",
  skipped: "Aucun e-mail envoyé : l'envoi d'e-mails n'est pas configuré sur ce serveur. Transmettez ces informations vous-même.",
  failed: "L'e-mail n'a pas pu être envoyé. Transmettez ces informations vous-même.",
};

// Shown once, right after the server generated it. It is not stored in clear
// anywhere and cannot be displayed again.
export function TemporaryPassword({ email, password, mail, onDone }: IssuedPassword & { onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <Alert tone="warning" title="Mot de passe temporaire, affiché une seule fois">
        Transmettez-le à la personne par un canal sûr si elle n&apos;a pas reçu l&apos;e-mail. Elle devra le changer à sa première connexion.
      </Alert>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted">Compte</dt>
        <dd className="font-semibold break-all">{email}</dd>
        <dt className="text-muted">Mot de passe</dt>
        <dd className="flex items-center gap-2">
          <code className="rounded-md bg-surface-2 px-2 py-1 font-mono text-base tracking-wider" data-testid="temporary-password">
            {password}
          </code>
          <Button type="button" variant="ghost" size="sm" onClick={copy} aria-label="Copier le mot de passe">
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? "Copié" : "Copier"}
          </Button>
        </dd>
      </dl>
      {mail && (
        <p className="flex items-start gap-2 text-sm text-muted" data-testid="mail-status" data-status={mail}>
          {mail === "sent" ? <Mail className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <MailX className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />}
          <span>{MAIL_LINE[mail]}</span>
        </p>
      )}
      <div className="flex justify-end">
        <Button type="button" onClick={onDone}>
          J&apos;ai transmis le mot de passe
        </Button>
      </div>
    </div>
  );
}
