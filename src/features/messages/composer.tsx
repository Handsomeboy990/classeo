"use client";

import { SendHorizonal } from "lucide-react";
import { useState } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { Textarea } from "@/components/ui/input";

import { FormRecovery } from "../contents/form-recovery";
import { sendMessage } from "./actions";
import { QUICK_MESSAGES } from "./templates";

// Quick replies then the message field. Phone: the quick replies are one row
// of chips scrolling sideways, right above a compact field, so the thread
// keeps most of the screen. From lg the chips wrap.
export function Composer({ conversationId, showQuick }: { conversationId: string; showQuick: boolean }) {
  const [text, setText] = useState("");
  return (
    <div className="flex flex-col gap-3 lg:gap-4">
      {showQuick && (
        <section aria-labelledby="quick-title">
          {/* The full title names the region; a phone shows its short form. */}
          <h2 id="quick-title" className="text-xs font-bold sm:text-sm">
            <span className="max-lg:sr-only">Messages rapides, un appui pour envoyer</span>
            <span className="lg:hidden" aria-hidden>
              Un appui pour envoyer
            </span>
          </h2>
          <ul className="-mx-4 mt-2 flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:thin] sm:-mx-5 sm:px-5 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0">
            {QUICK_MESSAGES.map((q) => (
              <li key={q.id} className="shrink-0">
                <ActionForm action={sendMessage}>
                  <input type="hidden" name="conversationId" value={conversationId} />
                  <input type="hidden" name="body" value={q.text} />
                  <SubmitButton variant="secondary" size="sm" pendingLabel="Envoi…" className="rounded-full whitespace-nowrap [&_svg]:size-5">
                    <q.Icon aria-hidden className="text-primary" /> {q.text}
                  </SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ActionForm action={sendMessage} successToast={false} onSuccess={() => setText("")} className="flex flex-col gap-2 lg:gap-3">
        <FormRecovery />
        <input type="hidden" name="conversationId" value={conversationId} />
        {/* Phone: the field and a round send button on one row, the label
            kept for screen readers only. From lg: labelled field, then the
            send button with its shortcut. */}
        <div className="flex items-end gap-2 lg:block">
          <FormField label="Votre message" name="body" className="min-w-0 flex-1 max-lg:[&>label]:sr-only">
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
          <SubmitButton pendingLabel="" size="icon" aria-label="Envoyer" title="Envoyer" className="size-12 shrink-0 rounded-full lg:hidden [&_svg]:size-5">
            <SendHorizonal aria-hidden />
          </SubmitButton>
        </div>
        <div className="flex items-center justify-between gap-3 max-lg:hidden">
          <p className="text-xs text-muted">Ctrl + Entrée pour envoyer</p>
          <SubmitButton pendingLabel="Envoi…" size="lg">
            <SendHorizonal aria-hidden /> Envoyer
          </SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
