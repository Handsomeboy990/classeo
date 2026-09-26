import { after } from "next/server";
import { z } from "zod";

import { guard, json } from "@/features/languages/guard";
import { drain, enqueue, lookup } from "@/features/languages/service";
import { isCandidate, isQueueable, MAX_UI_LENGTH, normalise } from "@/features/languages/text";

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
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Demande invalide." }, 400);
  const check = await guard(parsed.data.lang, "interface", 240);
  if (!check.ok) return check.response;

  const texts = [...new Set(parsed.data.texts.map(normalise).filter(isCandidate))];
  const found = await lookup(check.lang, texts);
  const missing = texts.filter((t) => !found.has(t) && isQueueable(t));
  if (missing.length) {
    enqueue(check.lang, missing);
    after(() => drain());
  }
  // A string cached as its own French text (the service could not translate
  // it) is not sent back.
  const translations = Object.fromEntries([...found].filter(([source, text]) => source !== text));
  return json({ lang: check.lang, translations, pending: missing.length });
}
