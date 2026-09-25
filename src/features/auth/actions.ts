"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";

import type { ActionState } from "@/lib/action";
import { audit } from "@/lib/audit";
import { dummyVerify, hashPassword, verifyPassword } from "@/lib/auth/password";
import { clientIp, createSession, destroySession, getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { platformUrl, sendMail } from "@/lib/mail";
import { passwordChangedEmail } from "@/lib/mail/templates";
import { hitRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { de } from "@/lib/utils";

const MAX_FAILED = 5;
const LOCK_MS = 15 * 60 * 1000;
const GENERIC = "Identifiant ou mot de passe incorrect.";
const LOCKED = "Compte temporairement verrouillé après plusieurs échecs. Réessayez dans 15 minutes.";

const loginSchema = z.object({
  // The identifier generated from the names; an e-mail still works for the
  // accounts that have one.
  login: z.string().trim().toLowerCase().min(2, "Saisissez votre identifiant.").max(200),
  password: z.string().min(1, "Saisissez votre mot de passe.").max(200),
  next: z.string().optional(),
});

function safeNext(next: string | undefined) {
  // Only same site relative paths, never "//host" or a full URL.
  return next && next.startsWith("/espace") && !next.startsWith("//") ? next : "/espace";
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: "Vérifiez les champs du formulaire.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const { login: identifier, password, next } = parsed.data;
  const ip = clientIp(await headers());

  // Without a trusted proxy the address is unknown ("direct"): the per account
  // limit and the lockout still apply, a shared IP bucket would lock everyone.
  const byIp = ip === "direct" ? { allowed: true, retryAfterMs: 0 } : await hitRateLimit(`login:ip:${ip}`, 30, LOCK_MS);
  const byEmail = await hitRateLimit(`login:account:${identifier}`, 10, LOCK_MS);
  if (!byIp.allowed || !byEmail.allowed) {
    const minutes = Math.ceil(Math.max(byIp.retryAfterMs, byEmail.retryAfterMs) / 60000);
    return { ok: false, message: `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.` };
  }

  // Nothing in the answer may tell an existing address from an unknown one:
  // an unknown address "locks" after the same number of attempts, and the
  // state of an account (locked, disabled) is never revealed without its
  // password.
  const user = await db.user.findUnique({ where: identifier.includes("@") ? { email: identifier } : { username: identifier } });
  if (!user) {
    if (byEmail.count > MAX_FAILED) return { ok: false, message: LOCKED };
    await dummyVerify(password);
    return { ok: false, message: GENERIC };
  }
  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) return { ok: false, message: LOCKED };

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    // A lock that has run out starts a new series, as the attempt window of
    // an unknown address does.
    const failed = (user.lockedUntil ? 0 : user.failedLoginCount) + 1;
    await db.user.update({
      where: { id: user.id },
      data: { failedLoginCount: failed, lockedUntil: failed >= MAX_FAILED ? new Date(now.getTime() + LOCK_MS) : null },
    });
    await audit(null, { action: "login_failed", resource: "user", resourceId: user.id, summary: `Échec de connexion pour ${identifier}` });
    return { ok: false, message: GENERIC };
  }
  if (!user.isActive) return { ok: false, message: "Ce compte est désactivé. Contactez votre administrateur." };

  await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await resetRateLimit(`login:account:${identifier}`);
  await createSession(user.id);
  await audit(null, { action: "login", resource: "user", resourceId: user.id, summary: `Connexion ${de(`${user.firstName} ${user.lastName}`)}`, schoolId: user.schoolId });

  redirect(user.mustChangePassword ? "/changer-mot-de-passe" : safeNext(next));
}

export async function logout() {
  await destroySession();
  redirect("/connexion");
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Saisissez votre mot de passe actuel."),
    password: z
      .string()
      .min(10, "10 caractères minimum.")
      .max(200)
      .regex(/[A-Za-z]/, "Au moins une lettre.")
      .regex(/[0-9]/, "Au moins un chiffre."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Les deux mots de passe ne correspondent pas." })
  .refine((d) => d.password !== d.current, { path: ["password"], message: "Choisissez un mot de passe différent de l'actuel." });

export async function changePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const current = await getCurrentUser();
  if (!current) redirect("/connexion");
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: "Vérifiez les champs du formulaire.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const user = await db.user.findUniqueOrThrow({ where: { id: current.id } });
  if (!(await verifyPassword(user.passwordHash, parsed.data.current))) {
    return { ok: false, message: "Mot de passe actuel incorrect.", fieldErrors: { current: ["Mot de passe actuel incorrect."] } };
  }
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.password), mustChangePassword: false } }),
    // Every other session of this account is closed.
    db.session.updateMany({ where: { userId: user.id, id: { not: current.sessionId }, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  await audit(current, { action: "update", resource: "user", resourceId: user.id, summary: "Changement de mot de passe" });
  // Security notice to the account's address, as after a reset by code. Sent
  // once the answer has left, so a slow mail server never delays the page.
  const at = new Date();
  const to = user.email;
  if (to)
    after(() =>
      sendMail({
        to,
        tag: "password_changed",
        ...passwordChangedEmail({ firstName: user.firstName, email: to, at, signInUrl: platformUrl("/connexion"), forgotUrl: platformUrl("/mot-de-passe-oublie"), keptSession: true }),
      }),
    );
  redirect("/espace");
}
