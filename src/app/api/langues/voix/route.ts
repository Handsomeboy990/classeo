import { z } from "zod";

import { guard, json } from "@/features/languages/guard";
import { speech, voiceAvailable } from "@/features/languages/service";

// A first synthesis can take a minute while the model loads.
export const maxDuration = 300;

const Body = z.object({
  lang: z.string().max(8),
  text: z.string().min(1).max(6000),
});

// Speech in Fon, Yoruba or Hausa for a French text: translated, then
// synthesised by the service, each clip cached as a file and reused. Answers
// the list of clips to play in order; on any failure the browser reads the
// French text with its own voice instead.
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Demande invalide." }, 400);
  const check = await guard(parsed.data.lang, "voix", 8);
  if (!check.ok) return check.response;
  const voice = await voiceAvailable(check.lang);
  if (!voice) return json({ error: "Pas de voix pour cette langue." }, 400);

  const result = await speech(check.lang, voice, parsed.data.text);
  if (!result.ok) return json({ error: "La voix en langue locale n'est pas disponible pour le moment." }, 503);
  return json({ clips: result.ids.map((id) => `/api/langues/audio/${id}`), complete: result.complete });
}
