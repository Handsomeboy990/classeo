"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { ForbiddenError } from "@/lib/auth/authorize";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { mailboxUsername, MAX_INSTITUTION_RECIPIENTS, parseMailboxUsername } from "@/lib/domain/institutions";
import { excerpt } from "@/lib/domain/messaging";
import { DomainError } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { withSubmission } from "@/features/offline/submission";

import { allowedContacts, conversationWhere, ensureMailbox, institutionOf, partySelect, resolveInstitutions, sides, staffOf } from "./queries";

type User = NonNullable<CurrentUser>;

const body = z.string().trim().min(1, "Écrivez un message ou choisissez un message rapide.").max(4000, "Le message est trop long (4 000 caractères au plus).");
const subject = z.string().trim().min(2, "Donnez un sujet à la conversation.").max(120, "Le sujet est trop long (120 caractères au plus).");

// Everyone on the other side hears about the message: people directly, and
// for an institution every member of staff who reads its mail.
async function notifyOthers(user: User, conversationId: string, text: string, as: string | null) {
  const rows = await db.conversationParticipant.findMany({ where: { conversationId }, select: { userId: true, user: { select: { username: true } } } });
  const inst = institutionOf(user);
  const mine = inst ? mailboxUsername(inst) : null;
  const ids: string[] = [];
  for (const r of rows) {
    if (r.userId === user.id || r.user.username === mine) continue;
    const mailbox = parseMailboxUsername(r.user.username);
    if (mailbox) ids.push(...(await staffOf(mailbox)));
    else ids.push(r.userId);
  }
  await notify(
    ids.filter((id) => id !== user.id),
    { kind: "message", title: as ? `Nouveau message de ${as}` : `Nouveau message de ${user.fullName}`, body: excerpt(text), link: `/espace/messages/${conversationId}` },
  );
}

const personSchema = z.object({
  mode: z.literal("person"),
  recipientId: z.string("Choisissez un destinataire.").min(1, "Choisissez un destinataire.").max(40),
  subject,
  body,
});

const institutionSchema = z.object({
  mode: z.literal("institution"),
  institutions: z
    .array(z.string().max(60), "Choisissez au moins un établissement ou un service.")
    .min(1, "Choisissez au moins un établissement ou un service.")
    .max(MAX_INSTITUTION_RECIPIENTS, `${MAX_INSTITUTION_RECIPIENTS} destinataires au plus.`),
  subject,
  body,
});

export const startConversation = createAction({
  permission: "message:create",
  schema: z.discriminatedUnion("mode", [personSchema, institutionSchema], "Choisissez à qui écrire."),
  handler: async (input, user) => {
    const now = new Date();
    if (input.mode === "person") {
      const contacts = await allowedContacts(user);
      const recipient = contacts.find((c) => c.id === input.recipientId);
      if (!recipient) throw new ForbiddenError("Vous ne pouvez pas écrire à cette personne.");
      const conversation = await db.conversation.create({
        data: {
          subject: input.subject,
          participants: { create: [{ userId: user.id, lastReadAt: now }, { userId: recipient.id }] },
          messages: { create: { senderId: user.id, body: input.body, createdAt: now } },
        },
      });
      await audit(user, { action: "create", resource: "conversation", resourceId: conversation.id, summary: `Nouvelle conversation avec ${recipient.name}` });
      await notifyOthers(user, conversation.id, input.body, null);
      redirect(`/espace/messages/${conversation.id}`);
    }

    // Institution to institution: one conversation per recipient, so each
    // one answers privately and shows its own read receipt.
    const { from, to } = await resolveInstitutions(user, input.institutions);
    const fromBox = await ensureMailbox(from);
    const boxes: string[] = [];
    for (const t of to) boxes.push(await ensureMailbox(t));
    const created = await db.$transaction(
      boxes.map((box) =>
        db.conversation.create({
          data: {
            subject: input.subject,
            participants: { create: [{ userId: fromBox, lastReadAt: now }, { userId: box }] },
            messages: { create: { senderId: user.id, body: input.body, createdAt: now } },
          },
          select: { id: true },
        }),
      ),
    );
    for (const [n, c] of created.entries()) {
      await audit(user, {
        action: "create",
        resource: "conversation",
        resourceId: c.id,
        summary: `Nouvelle conversation de ${from.name} avec ${to[n]!.name}${created.length > 1 ? ` (envoi groupé à ${created.length} destinataires)` : ""}`,
        metadata: { from: `${from.kind}:${from.id}`, to: `${to[n]!.kind}:${to[n]!.id}` },
        schoolId: from.kind === "SCHOOL" ? from.id : to[n]!.kind === "SCHOOL" ? to[n]!.id : null,
      });
      await notifyOthers(user, c.id, input.body, from.name);
    }
    if (created.length === 1) redirect(`/espace/messages/${created[0]!.id}`);
    redirect(`/espace/messages?envoye=${created.length}`);
  },
});

export const sendMessage = createAction({
  permission: "message:create",
  // clientId: one per message typed, so a message sent again after a lost
  // answer or replayed from the offline queue is written once.
  schema: z.object({ conversationId: z.string().min(1).max(40), body, clientId: z.uuid().optional() }),
  handler: (input, user) =>
    withSubmission(user, input.clientId, "message", async () => {
    // Scoped lookup: only a participant, or the staff of a participating
    // institution, finds the conversation.
    const conversation = await db.conversation.findFirst({
      where: { AND: [{ id: input.conversationId }, conversationWhere(user)] },
      select: { id: true, participants: { select: partySelect } },
    });
    if (!conversation) throw new DomainError("Cette conversation est introuvable.");
    const { me } = sides(user, conversation.participants);
    if (!me) throw new DomainError("Cette conversation est introuvable.");
    const now = new Date();
    const message = await db.message.create({ data: { conversationId: conversation.id, senderId: user.id, body: input.body, createdAt: now } });
    await db.conversation.update({ where: { id: conversation.id }, data: { updatedAt: now } });
    await db.conversationParticipant.update({ where: { conversationId_userId: { conversationId: conversation.id, userId: me.userId } }, data: { lastReadAt: now } });
    const on = me.kind === "PERSON" ? null : me.name;
    await audit(user, { action: "create", resource: "message", resourceId: message.id, summary: on ? `Message envoyé pour ${on}` : "Message envoyé", metadata: { conversationId: conversation.id } });
    await notifyOthers(user, conversation.id, input.body, on);
    return "Message envoyé.";
    }),
});
