import { z } from "zod";

import { guard, json } from "@/features/languages/guard";
import { speech, voiceAvailable } from "@/features/languages/service";
import { textSource } from "@/features/languages/sources";
import { publicClipUrl } from "@/lib/voice/clip-token";

// A first synthesis can take a minute while the model loads.
export const maxDuration = 300;

const Body = z
  .object({
    lang: z.string().max(8),
    text: z.string().min(1).max(6000).optional(),
    contentId: z.string().min(1).max(40).optional(),
    part: z.enum(["listen", "transcript"]).optional(),
  })
  .refine((b) => !!b.text !== !!b.contentId);

// Speech in Fon, Yoruba or Hausa for a French text: translated, then
// synthesised by the service, each clip cached as a file and reused. Answers
// the list of clips to play in order; on any failure the browser reads the
// French text with its own voice instead. The texts of the public pages are
// served to signed out visitors too: translated and synthesised once, then
// always from the cache. A text of the page holding a name, a phone number,
// an identifier or a message is refused (422): the service would have to
// receive it to read it.
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Demande invalide." }, 400);
  const check = await guard(parsed.data.lang, "voix", 8, { publicText: parsed.data.text });
  if (!check.ok) return check.response;
  const voice = await voiceAvailable(check.lang);
  if (!voice) return json({ error: "Pas de voix pour cette langue." }, 400);
  const source = await textSource(parsed.data);
  if (!source) return json({ error: "Ce contenu n'est pas disponible." }, 404);

  const result = await speech(check.lang, voice, source.text, 3, source.policy);
  if (!result.ok && result.reason === "private") return json({ error: "Ce texte contient des informations personnelles : lecture en français sur l'appareil." }, 422);
  if (!result.ok) return json({ error: "La voix en langue locale n'est pas disponible pour le moment." }, 503);
  const url = (id: string) => (check.userId ? `/api/langues/audio/${id}` : publicClipUrl(id));
  return json({ clips: result.ids.map(url), complete: result.complete });
}
