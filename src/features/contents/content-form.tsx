"use client";

import { Captions, Lightbulb, Save, Send } from "lucide-react";
import { useState } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { AUDIENCE_LABELS, requiresTranscript, type AudienceCode } from "@/lib/domain/content-targeting";

import { createContent, updateContent } from "./actions";
import { FormRecovery } from "./form-recovery";
import { CONTENT_TYPES, MEDIA_LABELS, type ContentTypeCode } from "./meta";
import type { TargetOption } from "./queries";

export type ContentFormValues = {
  id?: string;
  type: ContentTypeCode;
  title: string;
  easyRead: string;
  body: string;
  audience: AudienceCode;
  target: string;
  mediaType: keyof typeof MEDIA_LABELS;
  mediaUrl: string;
  transcript: string;
  subjectLabel: string;
  eventDate: string;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
};

// Every field is controlled so a refused submission keeps what the author
// typed; the server's field errors show under each field.
export function ContentForm({ initial, targets, canPublish }: { initial: ContentFormValues; targets: TargetOption[]; canPublish: boolean }) {
  const [v, setV] = useState(initial);
  const set = <K extends keyof ContentFormValues>(key: K) =>
    (e: { target: { value: string } }) => setV((prev) => ({ ...prev, [key]: e.target.value as ContentFormValues[K] }));

  const editing = !!initial.id;
  const alreadyPublished = initial.status === "PUBLISHED";
  const needsTranscript = requiresTranscript(v.mediaType);
  const groups = [...new Set(targets.map((t) => t.group))];

  return (
    <ActionForm action={editing ? updateContent : createContent} className="flex flex-col gap-6">
      <FormRecovery selects={{ type: v.type, target: v.target, audience: v.audience, mediaType: v.mediaType }} />
      {editing && <input type="hidden" name="id" value={initial.id} />}

      <Card>
        <CardHeader>
          <CardTitle>Le message</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <FormField label="Type" name="type" required>
            <Select value={v.type} onChange={set("type")}>
              {(Object.keys(CONTENT_TYPES) as ContentTypeCode[]).map((t) => (
                <option key={t} value={t}>
                  {CONTENT_TYPES[t].label}
                </option>
              ))}
            </Select>
          </FormField>
          {v.type === "EVENT" ? (
            <FormField label="Date et heure de l'événement" name="eventDate" required hint="Heure du Bénin.">
              <Input type="datetime-local" value={v.eventDate} onChange={set("eventDate")} />
            </FormField>
          ) : v.type === "RESOURCE" ? (
            <FormField label="Matière" name="subjectLabel" hint="Facultatif. Par exemple : Mathématiques.">
              <Input value={v.subjectLabel} onChange={set("subjectLabel")} maxLength={80} />
            </FormField>
          ) : (
            <span className="max-sm:hidden" />
          )}
          <FormField label="Titre" name="title" required className="sm:col-span-2">
            <Input value={v.title} onChange={set("title")} maxLength={160} />
          </FormField>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <FormField
              label="Résumé facile à lire"
              name="easyRead"
              hint="Une ou deux phrases courtes, avec des mots simples. Il est lu à voix haute en premier. 280 caractères au plus."
            >
              <Textarea value={v.easyRead} onChange={set("easyRead")} maxLength={280} className="min-h-20" />
            </FormField>
            {!v.easyRead.trim() && (
              <Alert tone="info">
                <span className="inline-flex items-center gap-1.5">
                  <Lightbulb className="size-4" aria-hidden /> Fortement conseillé : beaucoup de parents lisent peu ou écoutent le texte. Un résumé simple les aide à comprendre
                  l&apos;essentiel.
                </span>
              </Alert>
            )}
          </div>
          <FormField label="Texte complet" name="body" required className="sm:col-span-2">
            <Textarea value={v.body} onChange={set("body")} maxLength={10000} className="min-h-40" />
          </FormField>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Les destinataires</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <FormField label="Cible" name="target" required hint="Limitée à votre périmètre.">
            <Select value={v.target} onChange={set("target")}>
              <option value="">Choisir…</option>
              {groups.map((g) => (
                <optgroup key={g} label={g}>
                  {targets
                    .filter((t) => t.group === g)
                    .map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </Select>
          </FormField>
          <FormField label="Public" name="audience" required>
            <Select value={v.audience} onChange={set("audience")}>
              {(Object.keys(AUDIENCE_LABELS) as AudienceCode[]).map((a) => (
                <option key={a} value={a}>
                  {AUDIENCE_LABELS[a]}
                </option>
              ))}
            </Select>
          </FormField>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Média</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <FormField label="Type de média" name="mediaType" required>
            <Select value={v.mediaType} onChange={set("mediaType")}>
              {(Object.keys(MEDIA_LABELS) as (keyof typeof MEDIA_LABELS)[]).map((m) => (
                <option key={m} value={m}>
                  {MEDIA_LABELS[m]}
                </option>
              ))}
            </Select>
          </FormField>
          {v.mediaType !== "NONE" && (
            <FormField label="Adresse du média" name="mediaUrl" required={v.mediaType === "DOCUMENT" || v.mediaType === "IMAGE"} hint="Commence par https:// ou par /.">
              <Input type="url" inputMode="url" value={v.mediaUrl} onChange={set("mediaUrl")} maxLength={500} placeholder="https://" />
            </FormField>
          )}
          {v.mediaType !== "NONE" && (
            <div className="flex flex-col gap-2 sm:col-span-2">
              {needsTranscript && (
                <p className="flex items-start gap-2 text-sm text-muted">
                  <Captions className="mt-0.5 size-4 shrink-0" aria-hidden />
                  Obligatoire pour un audio ou une vidéo : les personnes sourdes ou malentendantes lisent la transcription à la place du son.
                </p>
              )}
              <FormField label="Transcription écrite" name="transcript" required={needsTranscript} hint="Tout ce qui est dit, mot pour mot.">
                <Textarea value={v.transcript} onChange={set("transcript")} maxLength={20000} className="min-h-32" />
              </FormField>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <ButtonLink href={editing ? `/espace/contenus/${initial.id}` : "/espace/contenus"} variant="ghost">
          Annuler
        </ButtonLink>
        <SubmitButton name="intent" value="draft" variant={canPublish && !alreadyPublished ? "secondary" : "primary"} pendingLabel="Enregistrement…">
          <Save aria-hidden /> {alreadyPublished ? "Enregistrer les modifications" : "Enregistrer le brouillon"}
        </SubmitButton>
        {canPublish && !alreadyPublished && (
          <SubmitButton name="intent" value="publish" pendingLabel="Publication…">
            <Send aria-hidden /> Publier
          </SubmitButton>
        )}
      </div>
    </ActionForm>
  );
}
