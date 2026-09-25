"use client";

import { ArrowRight, Check, CheckCheck } from "lucide-react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";

import { markAllNotificationsRead, markNotificationRead, openNotification } from "./actions";

export function MarkAllRead() {
  return (
    <ActionForm action={markAllNotificationsRead}>
      <SubmitButton variant="secondary" pendingLabel="En cours…">
        <CheckCheck aria-hidden /> Tout marquer comme lu
      </SubmitButton>
    </ActionForm>
  );
}

export function NotificationControls({ id, title, unread, hasLink }: { id: string; title: string; unread: boolean; hasLink: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {hasLink && (
        <ActionForm action={openNotification} successToast={false}>
          <input type="hidden" name="id" value={id} />
          <SubmitButton pendingLabel="Ouverture…" aria-label={`Ouvrir : ${title}`}>
            Ouvrir <ArrowRight aria-hidden />
          </SubmitButton>
        </ActionForm>
      )}
      {unread && (
        <ActionForm action={markNotificationRead} successToast={false}>
          <input type="hidden" name="id" value={id} />
          <SubmitButton variant="ghost" pendingLabel="En cours…" aria-label={`Marquer comme lu : ${title}`}>
            <Check aria-hidden /> Marquer comme lu
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
