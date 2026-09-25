"use client";

import { Archive, Pencil, Send, Trash2 } from "lucide-react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { ConfirmAction } from "@/components/kit/confirm-action";
import { Button, ButtonLink } from "@/components/ui/button";

import { archiveContent, deleteContent, publishContent } from "./actions";

// Edit, publish, archive and delete controls for one content. Shown only to
// users who may use them; every action checks again on the server.
export function ContentActions({
  id,
  title,
  status,
  canEdit,
  canPublish,
  canDelete,
  returnTo,
}: {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  canEdit: boolean;
  canPublish: boolean;
  canDelete: boolean;
  // List URL to come back to after a deletion, filters included.
  returnTo: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit && (
        <ButtonLink href={`/espace/contenus/${id}/modifier`} variant="secondary" aria-label={`Modifier « ${title} »`}>
          <Pencil aria-hidden /> Modifier
        </ButtonLink>
      )}
      {canPublish && status !== "PUBLISHED" && (
        <ActionForm action={publishContent}>
          <input type="hidden" name="id" value={id} />
          <SubmitButton pendingLabel="Publication…" aria-label={`Publier « ${title} »`}>
            <Send aria-hidden /> Publier
          </SubmitButton>
        </ActionForm>
      )}
      {canPublish && status === "PUBLISHED" && (
        <ConfirmAction
          action={archiveContent}
          fields={{ id }}
          tone="primary"
          title="Archiver ce contenu ?"
          description={`« ${title} » ne sera plus visible par les lecteurs. Vous pourrez le publier à nouveau plus tard.`}
          confirmLabel="Archiver"
          trigger={(open) => (
            <Button type="button" variant="secondary" onClick={open} aria-label={`Archiver « ${title} »`}>
              <Archive aria-hidden /> Archiver
            </Button>
          )}
        />
      )}
      {canDelete && (
        <ConfirmAction
          action={deleteContent}
          fields={{ id, returnTo }}
          title="Supprimer ce contenu ?"
          description={`« ${title} » sera supprimé définitivement. Cette action ne peut pas être annulée.`}
          confirmLabel="Supprimer"
          trigger={(open) => (
            <Button type="button" variant="ghost" onClick={open} className="text-danger" aria-label={`Supprimer « ${title} »`}>
              <Trash2 aria-hidden /> Supprimer
            </Button>
          )}
        />
      )}
    </div>
  );
}
