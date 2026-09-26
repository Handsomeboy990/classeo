import { after } from "next/server";
import { z } from "zod";

import { guard, json } from "@/features/languages/guard";
import { namesFor } from "@/features/languages/names";
import { drain, lookup, queueInterface } from "@/features/languages/service";
import { isCandidate, MAX_UI_LENGTH, normalise } from "@/features/languages/text";
import { getCurrentUser } from "@/lib/auth/session";

// The draining of the queue runs after the response and may wait for the
// quota of the translation service.
export const maxDuration = 300;

const Body = z.object({
  lang: z.string().max(8),
  texts: z.array(z.string().max(MAX_UI_LENGTH * 2)).max(800),
});

// Interface strings of the page being shown. Answers from the cache only,
// at once; strings not cached yet are queued and translated in the
// background, 100 per request, within the quota. The page stays in French
// for them until a later visit. A page asks a few times as it renders (the
// shell, then each streamed section, then a dialog): the per user limit
// only bounds a runaway client, the service quota is guarded by the queue.
// What is queued is decided here, never by the browser: names and figures
// become slots, contact details, identifiers and message excerpts are
// never queued (features/languages/privacy.ts).
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Demande invalide." }, 400);
  const check = await guard(parsed.data.lang, "interface", 240);
  if (!check.ok) return check.response;

  const texts = [...new Set(parsed.data.texts.map(normalise).filter(isCandidate))];
  const found = await lookup(check.lang, texts);
  const missing = texts.filter((t) => !found.has(t));
  const user = missing.length ? await getCurrentUser() : null;
  const queued = user ? await queueInterface(check.lang, missing, { userId: user.id, names: await namesFor(user) }) : 0;
  if (queued) after(() => drain());
  // A string cached as its own French text (the service could not translate
  // it) is not sent back.
  const translations = Object.fromEntries([...found].filter(([source, text]) => source !== text));
  return json({ lang: check.lang, translations, pending: queued });
}
