"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

// Shown once, right after the server generated it. It is not stored in clear
// anywhere and cannot be displayed again.
export function TemporaryPassword({ email, password, onDone }: { email: string; password: string; onDone: () => void }) {
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
        Transmettez-le à la personne par un canal sûr. Elle devra le changer à sa première connexion.
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
      <div className="flex justify-end">
        <Button type="button" onClick={onDone}>
          J&apos;ai transmis le mot de passe
        </Button>
      </div>
    </div>
  );
}
