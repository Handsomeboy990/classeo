"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { ForbiddenError } from "@/lib/auth/authorize";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { mailboxUsername, MAX_INSTITUTION_RECIPIENTS, parseMailboxUsername } from "@/lib/domain/institutions";
import { excerpt, VOICE_NOTE_MAX_MS, VOICE_NOTE_MIN_MS, voiceLabel } from "@/lib/domain/messaging";
import { DomainError } from "@/lib/errors";
import { saveUpload } from "@/lib/files";
import { notify } from "@/lib/notify";
import { hitRateLimit } from "@/lib/rate-limit";
import { withSubmission } from "@/features/offline/submission";

import { allowedContacts, conversationWhere, ensureMailbox, institutionOf, partySelect, resolveInstitutions, sides, staffOf, type Contact } from "./queries";
import { deliveryPlan, MAX_RECIPIENTS, resolveRecipients } from "./recipients";

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

const PICK_ONE = "Choisissez au moins un destinataire.";

const personSchema = z.object({
  mode: z.literal("person"),
  recipientIds: z
    .union([z.array(z.string().min(1).max(40)), z.string().min(1).max(40)], PICK_ONE)
    .transform((v) => (Array.isArray(v) ? v : [v]))
    .pipe(z.array(z.string()).min(1, PICK_ONE).max(MAX_RECIPIENTS, `${MAX_RECIPIENTS} destinataires au plus par envoi.`)),
  // Staff writing to staff only: one conversation where everyone reads
  // everyone. Ignored whenever a family takes part.
  shared: z
    .enum(["on"])
    .optional()
    .transform((v) => v === "on"),
  subject,
  body,
});

// Group sends fan out conversations and notifications: kept to a pace a
// person writing by hand never reaches.
const GROUP_SENDS_PER_HOUR = 20;
const VOICE_NOTES_PER_10_MIN = 30;

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
      // The same contact list as the single recipient path, computed on the
      // server: every picked id must be in it, or nothing is sent.
      const recipients = resolveRecipients(input.recipientIds, await allowedContacts(user));
      if (!recipients) throw new ForbiddenError(input.recipientIds.length > 1 ? "Vous ne pouvez pas écrire à l'une des personnes choisies." : "Vous ne pouvez pas écrire à cette personne.");
      const plan = deliveryPlan({ senderIsFamily: user.scope.level === "SELF", recipientsAreFamily: recipients.map((r) => r.family), wantShared: input.shared });
      if (plan !== "single") {
        const limit = await hitRateLimit(`message:group:${user.id}`, GROUP_SENDS_PER_HOUR, 3_600_000);
        if (!limit.allowed) throw new DomainError("Trop d'envois groupés en une heure. Réessayez un peu plus tard.");
      }
      const create = (people: Contact[]) =>
        db.conversation.create({
          data: {
            subject: input.subject,
            participants: { create: [{ userId: user.id, lastReadAt: now }, ...people.map((p) => ({ userId: p.id }))] },
            messages: { create: { senderId: user.id, body: input.body, createdAt: now } },
          },
          select: { id: true },
        });

      if (plan !== "separate") {
        const conversation = await create(recipients);
        const names = recipients.map((r) => r.name).join(", ");
        await audit(user, {
          action: "create",
          resource: "conversation",
          resourceId: conversation.id,
          summary: plan === "shared" ? `Nouvelle conversation de groupe avec ${names}` : `Nouvelle conversation avec ${names}`,
          metadata: { recipients: recipients.length, shared: plan === "shared" },
        });
        await notifyOthers(user, conversation.id, input.body, null);
        redirect(`/espace/messages/${conversation.id}`);
      }

      // One private conversation per recipient, written together.
      const created = await db.$transaction(recipients.map((r) => create([r])));
      for (const [n, c] of created.entries()) {
        await audit(user, {
          action: "create",
          resource: "conversation",
          resourceId: c.id,
          summary: `Nouvelle conversation avec ${recipients[n]!.name} (envoi groupé à ${created.length} destinataires)`,
          metadata: { recipients: created.length, shared: false },
        });
        await notifyOthers(user, c.id, input.body, null);
      }
      redirect(`/espace/messages?envoye=${created.length}`);
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
      const conversation = await ownConversation(user, input.conversationId);
      await post(user, conversation, { body: input.body }, input.body);
      return "Message envoyé.";
    }),
});

// Scoped lookup: only a participant, or the staff of a participating
// institution, finds the conversation.
async function ownConversation(user: User, conversationId: string) {
  const conversation = await db.conversation.findFirst({
    where: { AND: [{ id: conversationId }, conversationWhere(user)] },
    select: { id: true, participants: { select: partySelect } },
  });
  const me = conversation ? sides(user, conversation.participants).me : null;
  if (!conversation || !me) throw new DomainError("Cette conversation est introuvable.");
  return { id: conversation.id, me };
}

async function post(user: User, conversation: Awaited<ReturnType<typeof ownConversation>>, data: { body: string; audioFileId?: string; audioDurationMs?: number }, preview: string) {
  const { me } = conversation;
  const now = new Date();
  const message = await db.message.create({ data: { conversationId: conversation.id, senderId: user.id, createdAt: now, ...data } });
  await db.conversation.update({ where: { id: conversation.id }, data: { updatedAt: now } });
  await db.conversationParticipant.update({ where: { conversationId_userId: { conversationId: conversation.id, userId: me.userId } }, data: { lastReadAt: now } });
  const on = me.kind === "PERSON" ? null : me.name;
  const what = data.audioFileId ? "Message vocal envoyé" : "Message envoyé";
  await audit(user, { action: "create", resource: "message", resourceId: message.id, summary: on ? `${what} pour ${on}` : what, metadata: { conversationId: conversation.id } });
  await notifyOthers(user, conversation.id, preview, on);
}

// A voice note: the recording is checked from its bytes (WebM, Ogg or MP4
// audio, 2 MB at most), stored as a file only the participants can open
// (/api/files/[id]), and posted as a message. Voice notes need a
// connection: the offline queue holds text only.
export const sendVoiceNote = createAction({
  permission: "message:create",
  schema: z.object({
    conversationId: z.string().min(1).max(40),
    audio: z.instanceof(File, { message: "Aucun enregistrement reçu." }).refine((f) => f.size > 0, "L'enregistrement est vide."),
    durationMs: z.coerce
      .number()
      .int()
      .min(VOICE_NOTE_MIN_MS, "Message trop court : gardez le bouton un peu plus longtemps.")
      .max(VOICE_NOTE_MAX_MS + 1500, "Un message vocal dure 2 minutes au plus."),
    clientId: z.uuid().optional(),
  }),
  handler: (input, user) =>
    withSubmission(user, input.clientId, "message", async () => {
      const conversation = await ownConversation(user, input.conversationId);
      const limit = await hitRateLimit(`voice-note:${user.id}`, VOICE_NOTES_PER_10_MIN, 600_000);
      if (!limit.allowed) throw new DomainError("Trop de messages vocaux d'affilée. Attendez quelques minutes.");
      const durationMs = Math.min(input.durationMs, VOICE_NOTE_MAX_MS);
      const audioFileId = await saveUpload(user, "voice_note", new File([input.audio], "message-vocal", { type: input.audio.type }));
      await post(user, conversation, { body: "", audioFileId, audioDurationMs: durationMs }, voiceLabel(durationMs));
      return "Message vocal envoyé.";
    }),
});
