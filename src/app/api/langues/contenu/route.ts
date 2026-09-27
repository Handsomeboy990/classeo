import { z } from "zod";

import { guard, json } from "@/features/languages/guard";
import { translateNow } from "@/features/languages/service";
import { textSource } from "@/features/languages/sources";
import { normalise, segments } from "@/features/languages/text";

export const maxDuration = 60;

// An announcement by its identifier (the server reads it), or a text of the
// page. Never a message: the conversation pages offer no translation, and
// the server refuses any piece of a message the user can read.
const Body = z
  .object({
    lang: z.string().max(8),
    text: z.string().min(1).max(8000).optional(),
    contentId: z.string().min(1).max(40).optional(),
    part: z.enum(["listen", "transcript"]).optional(),
  })
  .refine((b) => !!b.text !== !!b.contentId);

// An announcement or a text of the page translated on request ("Traduire en
// fongbe"): paragraph by paragraph, from the cache first, the rest in one or
// two requests to the service. The French text is never lost: a paragraph
// the service could not translate, or that may not leave the platform (a
// name is sent as a slot, a phone number or an identifier not at all), comes
// back as is, flagged incomplete.
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Demande invalide." }, 400);
  const check = await guard(parsed.data.lang, "contenu", 10);
  if (!check.ok) return check.response;
  const source = await textSource(parsed.data);
  if (!source) return json({ error: "Ce contenu n'est pas disponible." }, 404);

  const parts = segments(source.text);
  const { translations, complete } = await translateNow(check.lang, parts, 20_000, source.policy);
  const paragraphs = parts.map((p) => {
    const t = translations.get(normalise(p));
    return { source: p, text: t ?? p, translated: !!t && t !== p };
  });
  if (!paragraphs.some((p) => p.translated)) {
    return json({ error: "La traduction n'est pas disponible pour le moment. Le texte reste en français." }, 503);
  }
  return json({ lang: check.lang, paragraphs, complete: complete && paragraphs.every((p) => p.translated) });
}
