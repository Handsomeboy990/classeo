"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { createAction } from "@/lib/action";
import { sendPush } from "@/lib/channels/push";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";

// Push subscriptions belong to the signed in user: no permission code, every
// query is scoped by the user's id.

const endpoint = z
  .string()
  .max(1000)
  .refine((v) => URL.canParse(v) && new URL(v).protocol === "https:", "Adresse d'abonnement invalide.");

const subscriptionSchema = z.object({
  endpoint,
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export const subscribePush = createAction({
  permission: null,
  schema: subscriptionSchema,
  handler: async ({ endpoint, keys }, user) => {
    const userAgent = (await headers()).get("user-agent")?.slice(0, 250) ?? null;
    // An endpoint identifies one browser. When someone else signs in on the
    // same phone and turns notifications on, the device becomes theirs.
    await db.pushSubscription.upsert({
      where: { endpoint },
      create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent, userId: user.id },
      update: { p256dh: keys.p256dh, auth: keys.auth, userAgent, userId: user.id },
    });
    return "Notifications activées sur cet appareil.";
  },
});

export const unsubscribePush = createAction({
  permission: null,
  schema: z.object({ endpoint }),
  handler: async ({ endpoint }, user) => {
    await db.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
    return "Notifications désactivées sur cet appareil.";
  },
});

// Tells the device whether its subscription belongs to the signed in user.
// One left by the previous user of a shared browser is deleted: the person
// now signed in never receives someone else's notifications.
export const checkPushDevice = createAction({
  permission: null,
  schema: z.object({ endpoint }),
  handler: async ({ endpoint }, user) => {
    const row = await db.pushSubscription.findUnique({ where: { endpoint }, select: { userId: true } });
    if (row && row.userId !== user.id) await db.pushSubscription.deleteMany({ where: { endpoint } });
    return { message: "", data: { mine: row?.userId === user.id } };
  },
});

export const sendTestPush = createAction({
  permission: null,
  schema: z.object({}),
  handler: async (_input, user) => {
    const { sent } = await sendPush([user.id], {
      kind: "test",
      title: "Notification d'essai",
      body: "Les notifications Classéo arrivent bien sur cet appareil.",
      link: "/espace/notifications",
    });
    if (!sent) throw new DomainError("Aucun appareil n'a pu être joint. Désactivez puis réactivez les notifications, puis réessayez.");
    return sent > 1 ? `Notification envoyée à vos ${sent} appareils.` : "Notification envoyée. Elle arrive dans quelques secondes.";
  },
});
