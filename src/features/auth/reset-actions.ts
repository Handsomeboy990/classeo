"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";

import type { ActionState } from "@/lib/action";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { clientIp } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { platformUrl, sendMail } from "@/lib/mail";
import { passwordChangedEmail, resetCodeEmail } from "@/lib/mail/templates";
import { hitRateLimit, resetRateLimit } from "@/lib/rate-limit";

import {
  generateResetCode,
  hashResetCode,
  matchesResetCode,
  normalizeResetCode,
  RESET_CODE_MINUTES,
  RESET_CODE_TTL_MS,
  RESET_EMAIL_COOKIE,
  RESET_MAX_ATTEMPTS,
  resetSecret,
  resetTokenExpiry,
  resetTokenState,
} from "./reset-code";

const COOKIE_PATH = "/mot-de-passe-oublie";

const WINDOW_MS = 15 * 60 * 1000;
const INVALID = "Code incorrect ou expiré. Vérifiez-le, ou demandez un nouveau code.";

const email = z.string().trim().toLowerCase().max(200).pipe(z.email("Saisissez une adresse e-mail valide."));

function tooMany(retryAfterMs: number): ActionState {
  const minutes = Math.max(1, Math.ceil(retryAfterMs / 60000));
  return { ok: false, message: `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.` };
}

// Per address limits only apply behind a trusted proxy, as for sign in: without
// one every visitor shares the "direct" key and would block everyone.
async function limit(prefix: string, ip: string, mail: string, perIp: number, perEmail: number) {
  const byIp = ip === "direct" ? { allowed: true, retryAfterMs: 0 } : await hitRateLimit(`${prefix}:ip:${ip}`, perIp, WINDOW_MS);
  const byEmail = await hitRateLimit(`${prefix}:email:${mail}`, perEmail, WINDOW_MS);
  return { allowed: byIp.allowed && byEmail.allowed, retryAfterMs: Math.max(byIp.retryAfterMs, byEmail.retryAfterMs) };
}

// Creates the code and e-mails it. Runs after the answer is sent, so the
// answer takes the same time whether the account exists or not.
async function issueCode(userId: string) {
  try {
    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, firstName: true, schoolId: true } });
    if (!user) return;
    const code = generateResetCode();
    const now = new Date();
    const token = await db.$transaction(async (tx) => {
      // A new code replaces every earlier one.
      await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
      return tx.passwordResetToken.create({
        data: { userId: user.id, codeHash: hashResetCode(code, user.id, resetSecret(process.env)), expiresAt: resetTokenExpiry(now) },
        select: { id: true },
      });
    });
    const status = await sendMail({
      to: user.email,
      tag: "password_reset_code",
      ...resetCodeEmail({ firstName: user.firstName, code, minutes: RESET_CODE_MINUTES, maxAttempts: RESET_MAX_ATTEMPTS, codeUrl: platformUrl("/mot-de-passe-oublie/code") }),
    });
    await audit(null, {
      action: "password_reset_requested",
      resource: "user",
      resourceId: user.id,
      schoolId: user.schoolId,
      summary: `Demande de réinitialisation du mot de passe de ${user.email}`,
      metadata: { tokenId: token.id, mail: status },
    });
  } catch (error) {
    console.error("password reset code failed", error);
  }
}

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ email }).safeParse({ email: formData.get("email") ?? "" });
  if (!parsed.success) return { ok: false, message: "Vérifiez le champ du formulaire.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const address = parsed.data.email;
  const h = await headers();

  const rate = await limit("reset", clientIp(h), address, 20, 3);
  if (!rate.allowed) return tooMany(rate.retryAfterMs);

  // Same answer, same work before it, for an unknown, disabled or existing
  // address: only the deferred task differs.
  const user = await db.user.findUnique({ where: { email: address }, select: { id: true, isActive: true } });
  if (user?.isActive) after(() => issueCode(user.id));

  (await cookies()).set(RESET_EMAIL_COOKIE, address, {
    httpOnly: true,
    sameSite: "lax",
    secure: h.get("x-forwarded-proto") === "https" || !!process.env.VERCEL || process.env.FORCE_HTTPS === "true",
    path: COOKIE_PATH,
    maxAge: RESET_CODE_TTL_MS / 1000,
  });
  redirect("/mot-de-passe-oublie/code");
}

const resetSchema = z
  .object({
    email,
    code: z
      .string()
      .max(20)
      .transform((v, ctx) => {
        const code = normalizeResetCode(v);
        if (!code) {
          ctx.addIssue({ code: "custom", message: "Le code compte 6 chiffres." });
          return z.NEVER;
        }
        return code;
      }),
    password: z
      .string()
      .min(10, "10 caractères minimum.")
      .max(200)
      .regex(/[A-Za-z]/, "Au moins une lettre.")
      .regex(/[0-9]/, "Au moins un chiffre."),
    confirm: z.string().max(200),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Les deux mots de passe ne correspondent pas." });

export async function resetPasswordWithCode(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Vérifiez les champs du formulaire.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { email: address, code, password } = parsed.data;

  const rate = await limit("reset-verify", clientIp(await headers()), address, 30, 10);
  if (!rate.allowed) return tooMany(rate.retryAfterMs);

  const user = await db.user.findUnique({ where: { email: address }, select: { id: true, email: true, firstName: true, isActive: true, schoolId: true } });
  const token = user?.isActive
    ? await db.passwordResetToken.findFirst({ where: { userId: user.id, usedAt: null }, orderBy: { createdAt: "desc" }, select: { id: true, codeHash: true, expiresAt: true, usedAt: true, attempts: true } })
    : null;
  const now = new Date();
  if (!user || !token || resetTokenState(token, now) !== "valid") return { ok: false, message: INVALID };

  // The attempt is counted before the comparison, atomically: parallel
  // guesses cannot go past the limit.
  const claimed = await db.passwordResetToken.updateMany({
    where: { id: token.id, usedAt: null, attempts: { lt: RESET_MAX_ATTEMPTS }, expiresAt: { gt: now } },
    data: { attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return { ok: false, message: INVALID };

  if (!matchesResetCode(token.codeHash, code, user.id, resetSecret(process.env))) {
    await audit(null, { action: "password_reset_failed", resource: "user", resourceId: user.id, schoolId: user.schoolId, summary: `Code de réinitialisation incorrect pour ${user.email}` });
    return { ok: false, message: INVALID };
  }

  const passwordHash = await hashPassword(password);
  const done = await db.$transaction(async (tx) => {
    // Single use, even when two correct submissions race.
    const consumed = await tx.passwordResetToken.updateMany({ where: { id: token.id, usedAt: null }, data: { usedAt: now } });
    if (consumed.count === 0) return false;
    await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
    await tx.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false, failedLoginCount: 0, lockedUntil: null } });
    await tx.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } });
    return true;
  });
  if (!done) return { ok: false, message: INVALID };

  await Promise.all([resetRateLimit(`login:email:${address}`), resetRateLimit(`reset-verify:email:${address}`)]);
  await audit(null, {
    action: "password_reset",
    resource: "user",
    resourceId: user.id,
    schoolId: user.schoolId,
    summary: `Réinitialisation du mot de passe de ${user.email} par code e-mail, sessions fermées`,
  });
  after(() =>
    sendMail({
      to: user.email,
      tag: "password_changed",
      ...passwordChangedEmail({ firstName: user.firstName, email: user.email, at: now, signInUrl: platformUrl("/connexion"), forgotUrl: platformUrl("/mot-de-passe-oublie") }),
    }),
  );
  (await cookies()).delete({ name: RESET_EMAIL_COOKIE, path: COOKIE_PATH });
  return { ok: true, message: "Votre mot de passe a été modifié. Connectez-vous avec le nouveau." };
}
