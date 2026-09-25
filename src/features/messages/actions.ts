"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { ForbiddenError } from "@/lib/auth/authorize";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { excerpt } from "@/lib/domain/messaging";
import { DomainError } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { withSubmission } from "@/features/offline/submission";

import { allowedContacts } from "./queries";

type User = NonNullable<CurrentUser>;

const body = z.string().trim().min(1, "Écrivez un message ou choisissez un message rapide.").max(4000, "Le message est trop long (4 000 caractères au plus).");

async function notifyOthers(user: User, conversationId: string, text: string) {
  const others = await db.conversationParticipant.findMany({ where: { conversationId, userId: { not: user.id } }, select: { userId: true } });
  await notify(
    others.map((o) => o.userId),
    { kind: "message", title: `Nouveau message de ${user.fullName}`, body: excerpt(text), link: `/espace/messages/${conversationId}` },
  );
}

export const startConversation = createAction({
  permission: "message:create",
  schema: z.object({
    recipientId: z.string().min(1, "Choisissez un destinataire.").max(40),
    subject: z.string().trim().min(2, "Donnez un sujet à la conversation.").max(120, "Le sujet est trop long (120 caractères au plus)."),
    body,
  }),
  handler: async (input, user) => {
    const contacts = await allowedContacts(user);
    const recipient = contacts.find((c) => c.id === input.recipientId);
    if (!recipient) throw new ForbiddenError("Vous ne pouvez pas écrire à cette personne.");
    const now = new Date();
    const conversation = await db.conversation.create({
      data: {
        subject: input.subject,
        participants: { create: [{ userId: user.id, lastReadAt: now }, { userId: recipient.id }] },
        messages: { create: { senderId: user.id, body: input.body, createdAt: now } },
      },
    });
    await audit(user, { action: "create", resource: "conversation", resourceId: conversation.id, summary: `Nouvelle conversation avec ${recipient.name}` });
    await notifyOthers(user, conversation.id, input.body);
    redirect(`/espace/messages/${conversation.id}`);
  },
});

export const sendMessage = createAction({
  permission: "message:create",
  // clientId: one per message typed, so a message sent again after a lost
  // answer or replayed from the offline queue is written once.
  schema: z.object({ conversationId: z.string().min(1).max(40), body, clientId: z.uuid().optional() }),
  handler: (input, user) =>
    withSubmission(user, input.clientId, "message", async () => {
    // Scoped lookup: only a participant finds the conversation.
    const conversation = await db.conversation.findFirst({ where: { id: input.conversationId, participants: { some: { userId: user.id } } }, select: { id: true } });
    if (!conversation) throw new DomainError("Cette conversation est introuvable.");
    const now = new Date();
    const message = await db.message.create({ data: { conversationId: conversation.id, senderId: user.id, body: input.body, createdAt: now } });
    await db.conversation.update({ where: { id: conversation.id }, data: { updatedAt: now } });
    await db.conversationParticipant.update({ where: { conversationId_userId: { conversationId: conversation.id, userId: user.id } }, data: { lastReadAt: now } });
    await audit(user, { action: "create", resource: "message", resourceId: message.id, summary: "Message envoyé", metadata: { conversationId: conversation.id } });
    await notifyOthers(user, conversation.id, input.body);
    return "Message envoyé.";
    }),
});
