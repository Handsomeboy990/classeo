"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";

import type { ActionState } from "@/lib/action";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

// A user's own notifications need no permission code, only a session, so
// these actions follow the createAction contract by hand: authenticate,
// validate, scope every write to the owner, report a message.

const SESSION_EXPIRED: ActionState = { ok: false, message: "Session expirée. Veuillez vous reconnecter." };
const FAILED: ActionState = { ok: false, message: "Une erreur inattendue est survenue. Réessayez dans un instant." };

const idSchema = z.object({ id: z.string().min(1).max(40) });

export async function markNotificationRead(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user) return SESSION_EXPIRED;
    const parsed = idSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: "Notification introuvable." };
    const { count } = await db.notification.updateMany({ where: { id: parsed.data.id, userId: user.id, readAt: null }, data: { readAt: new Date() } });
    return count ? { ok: true, message: "Notification marquée comme lue." } : { ok: false, message: "Notification introuvable ou déjà lue." };
  } catch (error) {
    console.error("notification update failed", error);
    return FAILED;
  }
}

export async function markAllNotificationsRead(): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user) return SESSION_EXPIRED;
    const { count } = await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
    return { ok: true, message: count ? `${count} notification${count > 1 ? "s" : ""} marquée${count > 1 ? "s" : ""} comme lue${count > 1 ? "s" : ""}.` : "Tout était déjà lu." };
  } catch (error) {
    console.error("notification update failed", error);
    return FAILED;
  }
}

export type UnreadSnapshot = { count: number; latestAt: number | null; latestTitle: string | null };

// What the open app polls to notice a new notification: the unread count
// and the newest unread one. A read only query on the user's own rows.
export async function unreadSnapshot(): Promise<UnreadSnapshot | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    const [count, latest] = await Promise.all([
      db.notification.count({ where: { userId: user.id, readAt: null } }),
      db.notification.findFirst({ where: { userId: user.id, readAt: null }, orderBy: { createdAt: "desc" }, select: { title: true, createdAt: true } }),
    ]);
    return { count, latestAt: latest?.createdAt.getTime() ?? null, latestTitle: latest?.title ?? null };
  } catch (error) {
    console.error("notification poll failed", error);
    return null;
  }
}

// Opens the target of a notification and marks it read. Only links inside
// the private space are followed, never an outside address.
export async function openNotification(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user) return SESSION_EXPIRED;
    const parsed = idSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: "Notification introuvable." };
    const n = await db.notification.findFirst({ where: { id: parsed.data.id, userId: user.id }, select: { id: true, link: true, readAt: true } });
    if (!n) return { ok: false, message: "Notification introuvable." };
    if (!n.readAt) await db.notification.update({ where: { id: n.id }, data: { readAt: new Date() } });
    const safe = n.link && /^\/espace(\/[\w\-/]*)?(\?[\w\-=&%]*)?$/.test(n.link) ? n.link : "/espace/notifications";
    redirect(safe);
  } catch (error) {
    unstable_rethrow(error);
    console.error("notification open failed", error);
    return FAILED;
  }
}
