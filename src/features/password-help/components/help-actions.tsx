"use client";

import { KeyRound, X } from "lucide-react";
import { createContext, useContext, useState, type ReactNode } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormDialog } from "@/components/kit/form-dialog";
import { FormField } from "@/components/kit/form-field";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { TemporaryPassword, type IssuedPassword } from "@/features/users/components/temporary-password";

import { rejectHelpRequest, resolveHelpRequest } from "../actions";

const IssueContext = createContext<(issued: IssuedPassword) => void>(() => {});

// Holds the password shown once, above the list: the refresh that follows a
// reset removes or changes the row, and must not take the password with it.
export function HelpIssuedProvider({ children }: { children: ReactNode }) {
  const [issued, setIssued] = useState<IssuedPassword | null>(null);
  return (
    <IssueContext.Provider value={setIssued}>
      {children}
      <Dialog open={!!issued} onClose={() => setIssued(null)} title="Nouveau mot de passe temporaire" size="sm">
        {issued && <TemporaryPassword {...issued} onDone={() => setIssued(null)} />}
      </Dialog>
    </IssueContext.Provider>
  );
}

// Answering a password help request: a temporary password shown once, or a
// refusal with its reason.
export function HelpRequestActions({ id, name, contact }: { id: string; name: string; contact: string | null }) {
  const [open, setOpen] = useState(false);
  const issue = useContext(IssueContext);
  return (
    <div className="flex flex-wrap justify-end gap-2 max-sm:w-full max-sm:*:flex-1">
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <KeyRound aria-hidden /> Réinitialiser
      </Button>
      <FormDialog
        action={rejectHelpRequest}
        title={`Refuser la demande de ${name} ?`}
        description="Par exemple si vous n'avez pas pu vérifier l'identité de la personne. Le motif est inscrit au journal."
        submitLabel="Refuser la demande"
        triggerVariant="secondary"
        triggerSize="sm"
        trigger={
          <>
            <X aria-hidden /> Refuser
          </>
        }
      >
        <input type="hidden" name="id" value={id} />
        <FormField label="Motif" name="note" required>
          <Textarea rows={3} maxLength={300} />
        </FormField>
      </FormDialog>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Réinitialiser le mot de passe de ${name} ?`} size="sm">
        <p className="text-sm leading-relaxed text-muted">
          Vérifiez d&apos;abord qu&apos;il s&apos;agit bien de cette personne{contact ? `, par exemple en la rappelant au ${contact}` : ""}. Un mot de passe temporaire
          sera affiché une seule fois ; ses sessions ouvertes seront fermées et elle choisira son propre mot de passe à la connexion.
        </p>
        <ActionForm
          action={resolveHelpRequest}
          successToast={false}
          onSuccess={(state) => {
            const data = state?.data as IssuedPassword | undefined;
            setOpen(false);
            if (data) issue(data);
          }}
          className="ds-dialog-actions mt-5"
        >
          <input type="hidden" name="id" value={id} />
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <SubmitButton pendingLabel="Réinitialisation…">Réinitialiser</SubmitButton>
        </ActionForm>
      </Dialog>
    </div>
  );
}
