"use client";

import { SendHorizonal } from "lucide-react";
import { useState } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { Textarea } from "@/components/ui/input";

import { FormRecovery } from "../contents/form-recovery";
import { sendMessage } from "./actions";
import { QUICK_MESSAGES } from "./templates";

export function Composer({ conversationId, showQuick }: { conversationId: string; showQuick: boolean }) {
  const [text, setText] = useState("");
  return (
    <div className="flex flex-col gap-4">
      {showQuick && (
        <section aria-labelledby="quick-title">
          <h2 id="quick-title" className="text-sm font-bold">
            Messages rapides, un appui pour envoyer
          </h2>
          <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_MESSAGES.map((q) => (
              <li key={q.id}>
                <ActionForm action={sendMessage}>
                  <input type="hidden" name="conversationId" value={conversationId} />
                  <input type="hidden" name="body" value={q.text} />
                  <SubmitButton variant="secondary" size="lg" pendingLabel="Envoi…" className="h-auto min-h-14 w-full justify-start py-3 text-left whitespace-normal [&_svg]:size-6">
                    <q.Icon aria-hidden className="text-primary" /> {q.text}
                  </SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ActionForm action={sendMessage} successToast={false} onSuccess={() => setText("")} className="flex flex-col gap-3">
        <FormRecovery />
        <input type="hidden" name="conversationId" value={conversationId} />
        <FormField label="Votre message" name="body">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={4000}
            className="min-h-24"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit();
            }}
          />
        </FormField>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted max-sm:hidden">Ctrl + Entrée pour envoyer</p>
          <SubmitButton pendingLabel="Envoi…" size="lg" className="max-sm:w-full">
            <SendHorizonal aria-hidden /> Envoyer
          </SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
