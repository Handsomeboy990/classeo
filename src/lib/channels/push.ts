import "server-only";

import webpush, { WebPushError } from "web-push";

import { db } from "@/lib/db";
import type { NotificationInput } from "@/lib/notify";

// Web push delivery (VAPID). Every subscription of the recipients receives
// the notification; the ones the push service reports as gone (404, 410)
// are deleted. Without the three VAPID variables the channel is off and the
// notification stays in the app only.

type Vapid = { publicKey: string; privateKey: string; subject: string };

function vapid(): Vapid | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject || !/^(mailto:|https:\/\/)/.test(subject)) return null;
  return { publicKey, privateKey, subject };
}

// The key the browser needs to subscribe, or null when push is not set up.
export function pushPublicKey(): string | null {
  return vapid()?.publicKey ?? null;
}

// Only links inside the private space are opened from a notification.
function safeLink(link: string | undefined) {
  return link && /^\/espace(\/[\w\-/]*)?(\?[\w\-=&%]*)?$/.test(link) ? link : "/espace/notifications";
}

const TTL_SECONDS = 24 * 60 * 60;

export async function sendPush(userIds: string[], input: NotificationInput): Promise<{ sent: number; failed: number }> {
  const keys = vapid();
  if (!keys || !userIds.length) return { sent: 0, failed: 0 };

  const subscriptions = await db.pushSubscription.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (!subscriptions.length) return { sent: 0, failed: 0 };

  const payload = JSON.stringify({ title: input.title, body: input.body, link: safeLink(input.link), tag: input.kind });
  const delivered: string[] = [];
  const gone: string[] = [];
  let failed = 0;

  await Promise.all(
    subscriptions.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          vapidDetails: keys,
          TTL: TTL_SECONDS,
          urgency: "normal",
          timeout: 10_000,
        });
        delivered.push(s.id);
      } catch (error) {
        if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) gone.push(s.id);
        else {
          failed++;
          console.error("push delivery failed", error instanceof WebPushError ? error.statusCode : error);
        }
      }
    }),
  );

  await Promise.all([
    gone.length ? db.pushSubscription.deleteMany({ where: { id: { in: gone } } }) : null,
    delivered.length ? db.pushSubscription.updateMany({ where: { id: { in: delivered } }, data: { lastUsedAt: new Date() } }) : null,
  ]);
  return { sent: delivered.length, failed: failed + gone.length };
}

// Called by notify(): never throws, a push failure must not undo anything.
export async function deliverPush(userIds: string[], input: NotificationInput): Promise<void> {
  try {
    await sendPush(userIds, input);
  } catch (error) {
    console.error("push channel failed", error);
  }
}
