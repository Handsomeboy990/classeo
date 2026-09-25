import { z } from "zod";

import { guard, json } from "@/features/languages/guard";
import { translateNow } from "@/features/languages/service";
import { normalise, segments } from "@/features/languages/text";

export const maxDuration = 60;

const Body = z.object({
  lang: z.string().max(8),
  text: z.string().min(1).max(8000),
});

// An announcement or a message translated on request ("Traduire en
// fongbe"): paragraph by paragraph, from the cache first, the rest in one or
// two requests to the service. The French text is never lost: a paragraph
// the service could not translate comes back as is, flagged incomplete.
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Demande invalide." }, 400);
  const check = await guard(parsed.data.lang, "contenu", 10);
  if (!check.ok) return check.response;

  const parts = segments(parsed.data.text);
  const { translations, complete } = await translateNow(check.lang, parts, 20_000);
  const paragraphs = parts.map((p) => {
    const t = translations.get(normalise(p));
    return { source: p, text: t ?? p, translated: !!t && t !== p };
  });
  if (!paragraphs.some((p) => p.translated)) {
    return json({ error: "La traduction n'est pas disponible pour le moment. Le texte reste en français." }, 503);
  }
  return json({ lang: check.lang, paragraphs, complete: complete && paragraphs.every((p) => p.translated) });
}
