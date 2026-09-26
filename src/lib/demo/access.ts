// Who may see the demonstration panel of the sign in page.
//
// The public /connexion shows it on a development machine only. Everywhere
// else the panel lives on a sign in page at an unguessable address,
// /acces/<DEMO_ACCESS_TOKEN>, sent by the owner to the people invited to try
// the platform. Pure functions of the environment, tested in access.test.ts;
// the page applies them in src/app/acces/[token]/page.tsx.

import { createHash, timingSafeEqual } from "node:crypto";

import { isProductionRun } from "./password";

type Env = Readonly<Record<string, string | undefined>>;

export const MIN_ACCESS_TOKEN_LENGTH = 32;
// Longer candidates are refused before any hashing.
export const MAX_ACCESS_TOKEN_LENGTH = 256;

// Constant time comparison of two strings of any length: both sides are
// hashed first, so neither the position of the first difference nor the
// length of the expected value shows in the time taken.
export function safeEqual(a: string, b: string) {
  const left = createHash("sha256").update(a, "utf8").digest();
  const right = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(left, right);
}

// Characters that stay the same in a URL path, so the token in the address
// is the token of the variable (openssl rand -hex 32 gives 64 of them).
const TOKEN_FORMAT = /^[A-Za-z0-9_-]+$/;

// The configured token, or null when the variable is unset, too short to
// resist guessing or not URL safe: the secret page then stays closed.
export function demoAccessToken(env: Env = process.env): string | null {
  const token = env.DEMO_ACCESS_TOKEN;
  return token && token.length >= MIN_ACCESS_TOKEN_LENGTH && token.length <= MAX_ACCESS_TOKEN_LENGTH && TOKEN_FORMAT.test(token) ? token : null;
}

export function isDemoAccessToken(candidate: string, env: Env = process.env) {
  const expected = demoAccessToken(env);
  if (!expected || candidate.length > MAX_ACCESS_TOKEN_LENGTH) return false;
  return safeEqual(candidate, expected);
}

// The panel on the public /connexion: on by default in development
// (DEMO_MODE=off hides it), off in a production build unless DEMO_MODE=on
// (a local production build), and never on the production deployment of
// Vercel, whatever DEMO_MODE says.
export function showPublicDemoPanel(env: Env = process.env) {
  if (env.VERCEL_ENV === "production") return false;
  if (isProductionRun(env)) return env.DEMO_MODE === "on";
  return env.DEMO_MODE !== "off";
}
