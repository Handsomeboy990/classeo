"use client";

import { useState, type ChangeEvent } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { Input, Textarea } from "@/components/ui/input";

import { reviewFamilyDocument } from "../actions";

// Kept in step with FAMILY_DOCUMENT_MAX_BYTES (src/lib/files.ts), which the
// server applies to the bytes it receives.
const MAX_BYTES = 3_000_000;
const MAX_SIDE = 1800;

// A phone photo of a document weighs several megabytes: it is redrawn at
// 1800 pixels on its long side, in JPEG, which stays readable and light on
// a weak network. A PDF is sent as it is.
async function shrink(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= MAX_BYTES) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    return blob ? new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

// File field of a piece: PDF or photo (the phone offers its camera), the
// photo made lighter before sending, the size checked before the upload.
export function PieceFileField({ label = "Fichier", hint, required = true }: { label?: string; hint?: string; required?: boolean }) {
  const [tooBig, setTooBig] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onChange(e: ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const picked = input.files?.[0];
    if (!picked) return setTooBig(false);
    setBusy(true);
    try {
      const small = await shrink(picked);
      if (small !== picked) {
        const dt = new DataTransfer();
        dt.items.add(small);
        input.files = dt.files;
      }
      setTooBig(small.size > MAX_BYTES);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <FormField label={label} name="file" required={required} hint={hint ?? "PDF ou photo nette du document, 3 Mo au plus. Sur téléphone, vous pouvez prendre la photo directement."}>
        <Input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          onChange={onChange}
          disabled={busy}
          className="file:mr-3 file:rounded-control file:border file:border-border-strong file:bg-surface file:px-3 file:py-1.5 file:font-semibold"
        />
      </FormField>
      {busy && (
        <p role="status" className="text-sm text-muted">
          Préparation de la photo…
        </p>
      )}
      {tooBig && (
        <p role="alert" className="text-sm font-semibold text-danger">
          Ce fichier dépasse 3 Mo. Prenez une photo du document ou envoyez un PDF plus léger.
        </p>
      )}
    </div>
  );
}

// The school's decision. A refusal needs a reason the family can act on.
export function ReviewForm({ documentId, health }: { documentId: string; health: boolean }) {
  return (
    <ActionForm action={reviewFamilyDocument} className="flex flex-col gap-4">
      <input type="hidden" name="documentId" value={documentId} />
      <FormField label="Message à la famille" name="note" hint="Obligatoire pour refuser : dites ce qui manque ou ce qui ne va pas.">
        <Textarea rows={3} maxLength={500} />
      </FormField>
      {health && <p className="text-sm text-muted">Pièce de santé : le fichier est supprimé dès votre réponse. Seuls la décision et, pour une dispense, sa période sont gardés.</p>}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <SubmitButton name="decision" value="REJECTED" variant="danger" pendingLabel="Envoi…">
          Refuser
        </SubmitButton>
        <SubmitButton name="decision" value="ACCEPTED" pendingLabel="Envoi…">
          Valider
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
