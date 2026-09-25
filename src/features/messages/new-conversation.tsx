"use client";

import { MessageSquarePlus, SendHorizonal } from "lucide-react";
import { useState } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select, Textarea } from "@/components/ui/input";

import { FormRecovery } from "../contents/form-recovery";
import { startConversation } from "./actions";
import type { Contact } from "./queries";
import { QUICK_MESSAGES } from "./templates";

export function NewConversation({ contacts, showQuick }: { contacts: Contact[]; showQuick: boolean }) {
  const [open, setOpen] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const groups = [...new Set(contacts.map((c) => c.group))];

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <MessageSquarePlus aria-hidden /> Nouvelle conversation
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Nouvelle conversation" description="Vous pouvez écrire aux personnes liées à votre scolarité ou à votre établissement." className="max-w-xl">
        {contacts.length === 0 ? (
          <p className="text-sm text-muted">Aucun contact disponible pour le moment. Vos contacts apparaissent dès qu&apos;un enfant ou une classe est rattaché à votre compte.</p>
        ) : (
          <ActionForm action={startConversation} successToast={false} className="flex flex-col gap-4">
            <FormRecovery selects={{ recipientId }} />
            <FormField label="Destinataire" name="recipientId" required>
              <Select value={recipientId} onChange={(e) => setRecipientId(e.target.value)}>
                <option value="">Choisir une personne…</option>
                {groups.map((g) => (
                  <optgroup key={g} label={g}>
                    {contacts
                      .filter((c) => c.group === g)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.detail ? ` (${c.detail})` : ""}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </Select>
            </FormField>
            {showQuick && (
              <fieldset>
                <legend className="text-sm font-semibold">Messages rapides</legend>
                <p className="text-xs text-muted">Un appui remplit le sujet et le message.</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {QUICK_MESSAGES.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      aria-pressed={body === q.text}
                      onClick={() => {
                        setBody(q.text);
                        setSubject(q.subject);
                      }}
                      className="flex min-h-12 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 py-2 text-left text-sm font-semibold hover:bg-surface-2 aria-pressed:border-primary aria-pressed:bg-primary-soft"
                    >
                      <q.Icon className="size-5 shrink-0 text-primary" aria-hidden /> {q.text}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            <FormField label="Sujet" name="subject" required>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} />
            </FormField>
            <FormField label="Message" name="body" required>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} />
            </FormField>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <SubmitButton pendingLabel="Envoi…">
                <SendHorizonal aria-hidden /> Envoyer
              </SubmitButton>
            </div>
          </ActionForm>
        )}
      </Dialog>
    </>
  );
}
