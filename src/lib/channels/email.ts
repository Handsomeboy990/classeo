import "server-only";

import { after } from "next/server";

import { db } from "@/lib/db";
import { platformUrl, sendMail } from "@/lib/mail";
import { notificationEmail } from "@/lib/mail/templates";
import type { NotificationInput } from "@/lib/notify";

// Only what a person must not miss leaves the app by e-mail. Everything else
// (new content, reminders) stays in the notification centre.
export const EMAIL_KINDS = new Set(["absence", "report_card", "request", "message"]);

// Messages go out a few at a time over the pooled transport, so a report card
// published to a whole school does not open hundreds of connections.
const BATCH_SIZE = 20;
// Upper bound for one notification: a larger audience is a broadcast, which
// belongs to announcements, not to transactional e-mail.
const MAX_RECIPIENTS = 2000;

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function send(userIds: string[], input: NotificationInput) {
  try {
    const recipients = await db.user.findMany({
      where: { id: { in: userIds.slice(0, MAX_RECIPIENTS) }, isActive: true },
      select: { email: true, firstName: true },
    });
    const url = platformUrl(input.link);
    const valid = recipients.filter((r): r is { email: string; firstName: string } => !!r.email && EMAIL_SHAPE.test(r.email));
    let sent = 0;
    for (let i = 0; i < valid.length; i += BATCH_SIZE) {
      const batch = valid.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((r) =>
          sendMail({ to: r.email, tag: `notification:${input.kind}`, ...notificationEmail({ firstName: r.firstName, kind: input.kind, title: input.title, body: input.body, url }) }),
        ),
      );
      sent += results.filter((r) => r.status === "fulfilled" && r.value === "sent").length;
    }
    if (valid.length > 1) console.info(`notification e-mails [${input.kind}]: ${sent} sent out of ${valid.length}`);
  } catch (error) {
    console.error("notification e-mail failed", error);
  }
}

// Called by notify() after the in-app record exists. The sending runs after
// the response when a request is in flight, so the action that caused the
// notification never waits for SMTP. Never throws.
export async function deliverEmail(userIds: string[], input: NotificationInput): Promise<void> {
  if (!EMAIL_KINDS.has(input.kind) || !userIds.length) return;
  try {
    after(() => send(userIds, input));
  } catch {
    // Outside a request (a script): send inline.
    await send(userIds, input);
  }
}
