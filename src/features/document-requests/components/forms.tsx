"use client";

import { Upload } from "lucide-react";
import { useState, type ReactNode } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { Input, Textarea } from "@/components/ui/input";

import { reviewDocRequest, uploadDocFile } from "../actions";
import { MAX_DOCUMENT_BYTES } from "../labels";

// One file per send keeps each request light on a weak connection. Its size
// is checked here first, so a heavy scan is refused before it is uploaded.
export function UploadDocForm({ requestId }: { requestId: string }) {
  const [tooBig, setTooBig] = useState(false);
  return (
    <ActionForm action={uploadDocFile} resetOnSuccess onSuccess={() => setTooBig(false)} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <input type="hidden" name="requestId" value={requestId} />
      <FormField label="Ajouter une pièce" name="file" hint="PDF, JPEG ou PNG, 950 Ko au maximum. Une photo nette du document suffit." className="min-w-0 flex-1">
        <Input
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          onChange={(e) => setTooBig((e.target.files?.[0]?.size ?? 0) > MAX_DOCUMENT_BYTES)}
          className="file:mr-3 file:rounded-control file:border file:border-border-strong file:bg-surface file:px-3 file:py-1.5 file:font-semibold"
        />
      </FormField>
      <SubmitButton variant="secondary" pendingLabel="Envoi…" disabled={tooBig}>
        <Upload aria-hidden /> Envoyer le fichier
      </SubmitButton>
      {tooBig && (
        <p role="alert" className="text-sm font-semibold text-danger sm:basis-full">
          Ce fichier dépasse 950 Ko : réduisez-le ou photographiez le document.
        </p>
      )}
    </ActionForm>
  );
}

// The authority accepts the pieces or sends them back with a note. Like the
// request decision form, it stays mounted once decided to keep the toast.
export function ReviewDocForm({ requestId, decided }: { requestId: string; decided: ReactNode | null }) {
  return (
    <ActionForm action={reviewDocRequest} className="flex flex-col gap-4">
      {decided ?? (
        <>
          <input type="hidden" name="requestId" value={requestId} />
          <FormField label="Note à l'établissement" name="note" hint="Obligatoire pour renvoyer : dites ce qui manque.">
            <Textarea rows={3} maxLength={1000} />
          </FormField>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <SubmitButton name="decision" value="REJECTED" variant="danger" pendingLabel="Traitement…">
              Renvoyer
            </SubmitButton>
            <SubmitButton name="decision" value="ACCEPTED" pendingLabel="Traitement…">
              Accepter
            </SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
