import "server-only";

import { headers } from "next/headers";

import { can } from "@/lib/auth/authorize";
import { clientIp, getCurrentUser } from "@/lib/auth/session";
import { hitRateLimit } from "@/lib/rate-limit";
import { isPublicSpeechText } from "@/lib/voice/allowlist";

import type { TargetLanguage } from "./languages";
import { translationAvailable } from "./service";

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

// Common checks of the language routes: a signed in user holding
// translation:view (never a role name: the ministry grants it from the
// rights matrix), the option on for this language, and a per user limit so
// that one account cannot drain the shared quota of the service. With
// `publicText`, the text of a public page (lib/voice/public-texts.ts) is
// served to anyone, signed in or not, limited per address when signed out:
// userId is then null.
export async function guard(
  lang: unknown,
  bucket: string,
  perMinute: number,
  options: { publicText?: string } = {},
): Promise<{ ok: true; lang: TargetLanguage; userId: string | null } | { ok: false; response: Response }> {
  const user = await getCurrentUser();
  const isPublic = options.publicText !== undefined && isPublicSpeechText(options.publicText);
  if (!user && !isPublic) return { ok: false, response: json({ error: "Session expirée. Veuillez vous reconnecter." }, 401) };
  if (user && !isPublic && !can(user, "translation:view")) return { ok: false, response: json({ error: "Vous n'avez pas accès à la traduction." }, 403) };
  if (typeof lang !== "string" || !(await translationAvailable(lang))) return { ok: false, response: json({ error: "Cette langue n'est pas disponible." }, 400) };
  const who = user ? user.id : `ip:${clientIp(await headers())}`;
  const hit = await hitRateLimit(`langues:${bucket}:${who}`, perMinute, 60_000);
  if (!hit.allowed) return { ok: false, response: json({ error: "Trop de demandes de traduction. Réessayez dans une minute." }, 429) };
  return { ok: true, lang: lang as TargetLanguage, userId: user?.id ?? null };
}
