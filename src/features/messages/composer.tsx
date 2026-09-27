"use client";

import { CloudUpload, Pencil, SendHorizonal, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { toast } from "@/components/kit/toaster";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { discardEntry, newClientId, queueEntry, useOfflineEntries } from "@/features/offline/client";
import { draftsOf } from "@/features/offline/queue";
import type { ActionState } from "@/lib/action";
import { cn, formatDateTime } from "@/lib/utils";

import { FormRecovery } from "../contents/form-recovery";
import { sendMessage } from "./actions";
import { QUICK_MESSAGES } from "./templates";
import { VoiceRecorder } from "./voice-recorder";

const QUEUED = "Pas de réseau : message gardé sur cet appareil. Il part automatiquement au retour du réseau.";

function entryFor(conversationId: string, body: string) {
  const title = document.querySelector("#page-content h1")?.textContent?.trim();
  return { kind: "message" as const, target: conversationId, payload: { conversationId, body }, baseline: null, page: window.location.pathname, label: `Message${title ? `, ${title}` : ""}` };
}

// The online action, with one identifier per message: a message sent again
// after a lost answer, or replayed from the offline queue, is written once.
// When the server cannot be reached the message joins the offline queue.
async function sendOrKeep(prev: ActionState, formData: FormData): Promise<ActionState> {
  const clientId = newClientId();
  formData.set("clientId", clientId);
  try {
    return await sendMessage(prev, formData);
  } catch (error) {
    const conversationId = String(formData.get("conversationId") ?? "");
    const body = String(formData.get("body") ?? "").trim();
    if (!body || !(await queueEntry(entryFor(conversationId, body), clientId))) throw error;
    toast("success", QUEUED);
    return { ok: true };
  }
}

// Quick replies then the message field. Phone: the quick replies are one row
// of chips scrolling sideways, right above a compact field, so the thread
// keeps most of the screen. From lg the chips wrap.
export function Composer({ conversationId, showQuick }: { conversationId: string; showQuick: boolean }) {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const entries = useOfflineEntries();
  const drafts = useMemo(() => draftsOf(entries, "message", conversationId), [entries, conversationId]);

  // Without network the forms never reach their action: the message is
  // queued at once, the page stays as it is.
  async function keepOffline(event: FormEvent<HTMLDivElement>) {
    if (navigator.onLine !== false) return;
    const form = event.target as HTMLFormElement;
    const body = String(new FormData(form).get("body") ?? "").trim();
    event.preventDefault();
    event.stopPropagation();
    if (!body) {
      toast("error", "Écrivez un message ou choisissez un message rapide.");
      return;
    }
    if (await queueEntry(entryFor(conversationId, body))) {
      if (form.elements.namedItem("body") instanceof HTMLTextAreaElement) setText("");
      toast("success", QUEUED);
    } else toast("error", "Pas de réseau et pas de stockage sur cet appareil : le message n'a pas pu être gardé.");
  }

  function reopen(clientId: string, body: string) {
    setText(body);
    void discardEntry(clientId);
    requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('textarea[name="body"]')?.focus());
  }

  return (
    <div className="flex flex-col gap-3 lg:gap-4" onSubmitCapture={keepOffline}>
      {(drafts.pending.length > 0 || drafts.rejected.length > 0) && (
        <section aria-labelledby="queued-title" className="flex flex-col gap-2">
          <h2 id="queued-title" className="sr-only">
            Messages gardés sur cet appareil
          </h2>
          <ul className="flex flex-col gap-2">
            {drafts.pending.map((d) => (
              <li key={d.clientId} className="ml-auto max-w-[85%] rounded-card border border-dashed border-warning bg-warning-soft px-3 py-2 text-sm">
                <p className="whitespace-pre-wrap">{d.payload.body}</p>
                <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-muted">
                  <CloudUpload className="size-3.5" aria-hidden /> En attente d&apos;envoi, écrit le {formatDateTime(new Date(d.createdAt))}
                </p>
              </li>
            ))}
            {drafts.rejected.map((d) => (
              <li key={d.clientId} role="alert" className="ml-auto max-w-[85%] rounded-card border border-danger/40 bg-danger-soft px-3 py-2 text-sm">
                <p className="whitespace-pre-wrap">{d.payload.body}</p>
                <p className="mt-1 text-xs font-semibold text-danger">Non envoyé : {d.error}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => reopen(d.clientId, d.payload.body)}>
                    <Pencil aria-hidden /> Reprendre le texte
                  </Button>
                  <Button size="sm" variant="danger-ghost" onClick={() => void discardEntry(d.clientId)}>
                    <Trash2 aria-hidden /> Abandonner
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {showQuick && (
        <section aria-labelledby="quick-title">
          {/* The full title names the region; a phone shows its short form. */}
          <h2 id="quick-title" className="font-display text-[0.6875rem] font-bold tracking-[0.08em] text-muted uppercase">
            <span className="max-lg:sr-only">Messages rapides, un appui pour envoyer</span>
            <span className="lg:hidden" aria-hidden>
              Un appui pour envoyer
            </span>
          </h2>
          <ul className="-mx-4 mt-2 flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:thin] sm:-mx-5 sm:px-5 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0">
            {QUICK_MESSAGES.map((q) => (
              <li key={q.id} className="shrink-0">
                <ActionForm action={sendOrKeep}>
                  <input type="hidden" name="conversationId" value={conversationId} />
                  <input type="hidden" name="body" value={q.text} />
                  <SubmitButton variant="soft" size="sm" pendingLabel="Envoi…" className="whitespace-nowrap text-text [&_svg]:size-5">
                    <q.Icon aria-hidden className="text-primary" /> {q.text}
                  </SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ActionForm action={sendOrKeep} successToast={false} onSuccess={() => setText("")} className="flex flex-col gap-2 lg:gap-3">
        <FormRecovery />
        <input type="hidden" name="conversationId" value={conversationId} />
        {/* Phone: the field, the microphone and a round send button on one
            row, the label kept for screen readers only. From lg: labelled
            field and microphone, then the send button with its shortcut.
            While a voice note is recorded or previewed it takes the row. */}
        {voiceError && (
          <p role="alert" className="rounded-control border border-danger/30 bg-danger-soft px-3 py-2 text-sm">
            {voiceError}
          </p>
        )}
        <div className="flex items-end gap-2">
          <FormField label="Votre message" name="body" className={cn("min-w-0 flex-1 max-lg:[&>label]:sr-only", voice && "hidden")}>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={4000}
              rows={2}
              placeholder="Votre message"
              className="min-h-24 max-lg:min-h-0"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit();
              }}
            />
          </FormField>
          <VoiceRecorder conversationId={conversationId} onActiveChange={setVoice} onError={setVoiceError} />
          <SubmitButton pendingLabel="" size="icon" aria-label="Envoyer" title="Envoyer" className={cn("size-12 shrink-0 lg:hidden [&_svg]:size-5", voice && "hidden")}>
            <SendHorizonal aria-hidden />
          </SubmitButton>
        </div>
        <div className={cn("flex items-center justify-between gap-3 max-lg:hidden", voice && "lg:hidden")}>
          <p className="text-xs text-muted">Ctrl + Entrée pour envoyer</p>
          <SubmitButton pendingLabel="Envoi…" size="lg">
            <SendHorizonal aria-hidden /> Envoyer
          </SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
