"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { ActionState } from "@/lib/action";
import { audit } from "@/lib/audit";
import { dummyVerify, hashPassword, verifyPassword } from "@/lib/auth/password";
import { clientIp, createSession, destroySession, getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hitRateLimit, resetRateLimit } from "@/lib/rate-limit";

const MAX_FAILED = 5;
const LOCK_MS = 15 * 60 * 1000;
const GENERIC = "Adresse e-mail ou mot de passe incorrect.";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Saisissez une adresse e-mail valide.").max(200),
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
  const { email, password, next } = parsed.data;
  const ip = clientIp(await headers());

  const byIp = await hitRateLimit(`login:ip:${ip}`, 30, LOCK_MS);
  const byEmail = await hitRateLimit(`login:email:${email}`, 10, LOCK_MS);
  if (!byIp.allowed || !byEmail.allowed) {
    const minutes = Math.ceil(Math.max(byIp.retryAfterMs, byEmail.retryAfterMs) / 60000);
    return { ok: false, message: `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.` };
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    await dummyVerify(password);
    return { ok: false, message: GENERIC };
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { ok: false, message: "Compte temporairement verrouillé après plusieurs échecs. Réessayez dans 15 minutes." };
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid || !user.isActive) {
    const failed = user.failedLoginCount + 1;
    await db.user.update({
      where: { id: user.id },
      data: { failedLoginCount: failed, lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MS) : null },
    });
    await audit(null, { action: "login_failed", resource: "user", resourceId: user.id, summary: `Échec de connexion pour ${email}` });
    return { ok: false, message: user.isActive ? GENERIC : "Ce compte est désactivé. Contactez votre administrateur." };
  }

  await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await resetRateLimit(`login:email:${email}`);
  await createSession(user.id);
  await audit(null, { action: "login", resource: "user", resourceId: user.id, summary: `Connexion de ${user.firstName} ${user.lastName}`, schoolId: user.schoolId });

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
  redirect("/espace");
}
