"use client";

import { PenLine, Trash2 } from "lucide-react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { ConfirmButton } from "@/components/kit/confirm-button";
import { ImageUpload } from "@/components/kit/image-upload";

import { removeSignatureImage, signClassReportCards, signDocument, uploadSignatureImage } from "../actions";

// Upload of a signature or stamp image, a transparent PNG (resized in the
// browser, the transparency kept).
export function SignatureImageForm({ purpose, currentUrl }: { purpose: "signature" | "stamp"; currentUrl: string | null }) {
  const isStamp = purpose === "stamp";
  return (
    <ActionForm action={uploadSignatureImage} className="flex flex-col gap-3">
      <input type="hidden" name="purpose" value={purpose} />
      <ImageUpload
        name="file"
        label={isStamp ? "Image du cachet" : "Image de la signature"}
        currentUrl={currentUrl}
        keepAlpha
        maxSide={isStamp ? 500 : 700}
        accept="image/png,image/webp"
        shape={isStamp ? "circle" : "wide"}
        hint={isStamp ? "PNG à fond transparent, cachet rond de préférence. 800 Ko au maximum." : "PNG à fond transparent, signature à l'encre foncée. 500 Ko au maximum."}
      />
      <div className="flex flex-wrap gap-2">
        <SubmitButton size="sm" pendingLabel="Envoi…">
          {isStamp ? "Enregistrer ce cachet" : "Enregistrer cette image"}
        </SubmitButton>
        {currentUrl && (
          <ConfirmButton
            action={removeSignatureImage}
            fields={{ purpose }}
            title={isStamp ? "Retirer le cachet ?" : "Retirer la signature ?"}
            description={
              isStamp
                ? "Les prochains documents signés ne porteront plus de cachet. Les documents déjà signés restent valables."
                : "Vous ne pourrez plus signer de document avant d'avoir enregistré une nouvelle signature. Les documents déjà signés restent valables."
            }
            confirmLabel="Retirer"
            variant="danger-ghost"
            size="sm"
          >
            <Trash2 aria-hidden /> Retirer
          </ConfirmButton>
        )}
      </div>
    </ActionForm>
  );
}

export function SignButton({ kind, subjectId, label, description }: { kind: "attestation" | "certificat" | "bulletin"; subjectId: string; label: string; description: string }) {
  return (
    <ConfirmButton
      action={signDocument}
      fields={{ kind, subjectId }}
      title={label}
      description={description}
      confirmLabel="Signer"
      tone="primary"
      variant="soft"
      size="sm"
    >
      <PenLine aria-hidden /> {label}
    </ConfirmButton>
  );
}

export function SignClassButton({ classroomId, periodId, classroom, period, remaining }: { classroomId: string; periodId: string; classroom: string; period: string; remaining: number }) {
  return (
    <ConfirmButton
      action={signClassReportCards}
      fields={{ classroomId, periodId }}
      title={`Signer les bulletins de la ${classroom} ?`}
      description={`${remaining} bulletin${remaining > 1 ? "s" : ""} publié${remaining > 1 ? "s" : ""} du ${period} recevr${remaining > 1 ? "ont" : "a"} votre signature et votre cachet. Un bulletin modifié après signature perd sa signature et doit être signé à nouveau.`}
      confirmLabel="Signer les bulletins"
      tone="primary"
      variant="soft"
      size="sm"
    >
      <PenLine aria-hidden /> Signer {remaining > 1 ? `les ${remaining} bulletins` : "le bulletin"}
    </ConfirmButton>
  );
}
