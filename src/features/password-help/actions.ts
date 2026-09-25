"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";

import { createAction, type ActionState } from "@/lib/action";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { clientIp } from "@/lib/auth/session";
import { normalizeLogin } from "@/lib/auth/username";
import { db } from "@/lib/db";
import { generateTemporaryPassword } from "@/lib/domain/rights";
import { DomainError } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { hitRateLimit, resetRateLimit } from "@/lib/rate-limit";

import { handlerIds, helpRequestWhere } from "./queries";
import { canHandleHelp } from "./routing";

const WINDOW_MS = 15 * 60 * 1000;

const requestSchema = z.object({
  login: z.string().trim().min(2, "Saisissez votre identifiant.").max(200).transform(normalizeLogin),
  contact: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => v?.replace(/\s+/g, " ") || null)
    .refine((v) => v === null || /^[0-9+ ]{8,20}$/.test(v), "Numéro invalide : chiffres, espaces et + uniquement."),
});

// Records the request and alerts the people who handle it. Runs after the
// answer is sent, so an existing identifier costs no extra time.
async function fileRequest(userId: string, contact: string | null) {
  try {
    const pending = await db.passwordHelpRequest.findFirst({ where: { userId, status: "PENDING" }, select: { id: true } });
    // One waiting request per account: asking again only updates the number
    // to call back.
    const request = pending
      ? await db.passwordHelpRequest.update({ where: { id: pending.id }, data: contact ? { contact } : {}, select: { id: true } })
      : await db.passwordHelpRequest.create({ data: { userId, contact }, select: { id: true } });
    const user = await db.user.findUnique({ where: { id: userId }, select: { username: true, firstName: true, lastName: true, schoolId: true } });
    if (!user) return;
    await audit(null, {
      action: "password_help_requested",
      resource: "user",
      resourceId: userId,
      schoolId: user.schoolId,
      summary: `Demande d'aide pour un mot de passe oublié : ${user.username}`,
      metadata: { requestId: request.id, repeated: !!pending },
    });
    if (!pending)
      await notify(await handlerIds(userId), {
        kind: "password_help",
        title: "Mot de passe oublié",
        body: `${user.firstName} ${user.lastName} (${user.username}) demande un nouveau mot de passe.`,
        link: "/espace/aide-connexion",
      });
  } catch (error) {
    console.error("password help request failed", error);
  }
}

// Public: the person cannot sign in. The same answer comes back whether the
// identifier exists or not, and nothing is written before it.
export async function requestPasswordHelp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = requestSchema.safeParse({ login: formData.get("login") ?? "", contact: formData.get("contact") ?? undefined });
  if (!parsed.success) return { ok: false, message: "Vérifiez les champs du formulaire.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { login, contact } = parsed.data;

  const ip = clientIp(await headers());
  const byIp = ip === "direct" ? { allowed: true, retryAfterMs: 0 } : await hitRateLimit(`help:ip:${ip}`, 20, WINDOW_MS);
  const byAccount = await hitRateLimit(`help:account:${login}`, 3, WINDOW_MS);
  if (!byIp.allowed || !byAccount.allowed) {
    const minutes = Math.max(1, Math.ceil(Math.max(byIp.retryAfterMs, byAccount.retryAfterMs) / 60000));
    return { ok: false, message: `Trop de demandes. Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.` };
  }

  const user = await db.user.findUnique({ where: login.includes("@") ? { email: login } : { username: login }, select: { id: true, isActive: true } });
  if (user?.isActive) after(() => fileRequest(user.id, contact));
  return { ok: true, message: "Demande transmise." };
}

const id = z.string().trim().min(1).max(64);

// A request the handler may act on: waiting, routed to them, and allowed by
// the hierarchy rule (routing.ts).
async function handledRequest(user: Parameters<typeof helpRequestWhere>[0], requestId: string) {
  const request = await db.passwordHelpRequest.findFirst({
    where: { AND: [{ id: requestId, status: "PENDING" }, helpRequestWhere(user)] },
    select: {
      id: true,
      user: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          isActive: true,
          scopeLevel: true,
          schoolId: true,
          role: { select: { permissions: { select: { permission: { select: { code: true } } } } } },
        },
      },
    },
  });
  if (!request) throw new DomainError("Demande introuvable ou déjà traitée.");
  const rule = canHandleHelp(
    { scopeLevel: user.scope.level, permissions: user.permissions },
    { scopeLevel: request.user.scopeLevel, permissions: request.user.role.permissions.map((p) => p.permission.code) },
  );
  if (!rule.ok) {
    await audit(user, { action: "denied", resource: "user", resourceId: request.user.id, summary: `Réinitialisation refusée pour ${request.user.username}`, metadata: { reason: rule.reason } });
    throw new DomainError(rule.reason);
  }
  return request;
}

export const resolveHelpRequest = createAction({
  permission: "user:update",
  schema: z.object({ id }),
  handler: async (input, user) => {
    const request = await handledRequest(user, input.id);
    const target = request.user;
    if (!target.isActive) throw new DomainError("Ce compte est désactivé : il doit d'abord être réactivé depuis « Comptes utilisateurs ».");

    const password = generateTemporaryPassword();
    const passwordHash = await hashPassword(password);
    const now = new Date();
    await db.$transaction(async (tx) => {
      // Two handlers answering at once: only the first one resets.
      const claimed = await tx.passwordHelpRequest.updateMany({ where: { id: request.id, status: "PENDING" }, data: { status: "RESOLVED", handledById: user.id, handledAt: now } });
      if (claimed.count === 0) throw new DomainError("Cette demande vient d'être traitée par quelqu'un d'autre.");
      await tx.passwordHelpRequest.updateMany({ where: { userId: target.id, status: "PENDING" }, data: { status: "RESOLVED", handledById: user.id, handledAt: now } });
      await tx.user.update({ where: { id: target.id }, data: { passwordHash, mustChangePassword: true, failedLoginCount: 0, lockedUntil: null } });
      await tx.session.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: now } });
    });
    await resetRateLimit(`login:account:${target.username}`);
    await audit(user, {
      action: "reset_password",
      resource: "user",
      resourceId: target.id,
      schoolId: target.schoolId,
      summary: `Réinitialisation du mot de passe de ${target.username} à sa demande, sessions fermées`,
      metadata: { requestId: request.id },
    });
    return { message: "Mot de passe réinitialisé.", data: { username: target.username, password } };
  },
});

export const rejectHelpRequest = createAction({
  permission: "user:update",
  schema: z.object({ id, note: z.string().trim().min(3, "Expliquez le motif en quelques mots.").max(300, "300 caractères maximum.") }),
  handler: async (input, user) => {
    const request = await handledRequest(user, input.id);
    const done = await db.passwordHelpRequest.updateMany({
      where: { id: request.id, status: "PENDING" },
      data: { status: "REJECTED", handledById: user.id, handledAt: new Date(), note: input.note },
    });
    if (done.count === 0) throw new DomainError("Cette demande vient d'être traitée par quelqu'un d'autre.");
    await audit(user, {
      action: "reject",
      resource: "user",
      resourceId: request.user.id,
      schoolId: request.user.schoolId,
      summary: `Demande de réinitialisation de ${request.user.username} refusée`,
      metadata: { requestId: request.id, note: input.note },
    });
    return "Demande refusée.";
  },
});
