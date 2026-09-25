// Rules of the forgotten password code. Pure functions, unit tested; the
// server actions in reset-actions.ts apply them.

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const RESET_CODE_TTL_MS = 15 * 60 * 1000;
export const RESET_CODE_MINUTES = RESET_CODE_TTL_MS / 60_000;
export const RESET_MAX_ATTEMPTS = 5;

// Remembers which address a code was asked for, so the code page is
// prefilled. It only holds what the visitor typed and proves nothing.
export const RESET_EMAIL_COOKIE = "classeo_reset_email";

// Six digits drawn from a cryptographic source, leading zeros kept.
export function generateResetCode(random: (max: number) => number = randomInt): string {
  return String(random(1_000_000)).padStart(6, "0");
}

// People copy codes with spaces or dashes ("048 213"): those are dropped.
// Anything else than six digits is refused.
export function normalizeResetCode(input: string): string | null {
  const compact = input.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(compact) ? compact : null;
}

// The code is stored as an HMAC keyed with a server secret and bound to the
// account, so a leaked table gives nothing to try offline and a code is only
// valid for the account it was sent to.
export function hashResetCode(code: string, userId: string, secret: string): string {
  return createHmac("sha256", secret).update(`password-reset:v1:${userId}:${code}`).digest("hex");
}

export function matchesResetCode(storedHash: string, code: string, userId: string, secret: string): boolean {
  const expected = Buffer.from(storedHash, "hex");
  const actual = Buffer.from(hashResetCode(code, userId, secret), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export type ResetTokenState = "valid" | "used" | "expired" | "exhausted";

export function resetTokenState(token: { expiresAt: Date; usedAt: Date | null; attempts: number }, now: Date): ResetTokenState {
  if (token.usedAt) return "used";
  if (token.expiresAt.getTime() <= now.getTime()) return "expired";
  if (token.attempts >= RESET_MAX_ATTEMPTS) return "exhausted";
  return "valid";
}

export function resetTokenExpiry(now: Date): Date {
  return new Date(now.getTime() + RESET_CODE_TTL_MS);
}

// The session secret, with its own purpose in the hashed message: no extra
// variable to manage, and rotating it also voids every pending code.
export function resetSecret(env: Record<string, string | undefined>): string {
  const secret = env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return secret;
}
