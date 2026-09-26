import { headers } from "next/headers";
import { z } from "zod";

import { clientIp, getCurrentUser } from "@/lib/auth/session";
import { hitRateLimit } from "@/lib/rate-limit";
import { isPublicSpeechText } from "@/lib/voice/allowlist";
import { publicClipUrl } from "@/lib/voice/clip-token";
import { frenchClip, piperConfig, voiceAvailable } from "@/lib/voice/piper";
import { frenchParts, MAX_SPOKEN_LENGTH } from "@/lib/voice/speech-text";

// Whether the voice is configured is read at request time, never at build.
export const dynamic = "force-dynamic";
// The first clip of a new instance of the voice function also loads the
// model.
export const maxDuration = 90;

const DAY_MS = 24 * 60 * 60 * 1000;
// New clips a signed in user may cause per day (about 100 000 characters),
// so that one account cannot keep the voice function busy. Cached clips are
// free.
const NEW_CLIPS_PER_DAY = 500;

const Body = z.object({
  text: z.string().min(1).max(MAX_SPOKEN_LENGTH * 2),
  part: z.number().int().min(0).max(200),
});

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

// The voice Kora reads French with on every device, or null when the
// browser must use its own (voice function not configured, or failing for
// now).
export async function GET(request: Request) {
  return json({ voice: voiceAvailable(piperConfig(request)) ? "Siwis" : null });
}

// One part of a French text read by Piper (voice Siwis): the browser sends
// the whole text and the number of the part, the server cuts the text the
// same way (lib/voice/speech-text.ts), and answers the address of the
// cached clip. Signed in users may have any text read; a signed out
// visitor only the texts of the public pages. Any failure answers 503 and
// the browser reads with its own voice instead.
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Demande invalide." }, 400);
  const { text, part } = parsed.data;
  const user = await getCurrentUser();
  if (!user && !isPublicSpeechText(text)) return json({ error: "Connectez-vous pour écouter ce texte." }, 401);
  const config = piperConfig(request);
  if (!voiceAvailable(config)) return json({ error: "La voix du serveur n'est pas disponible." }, 503);
  const hit = user ? await hitRateLimit(`voix:fr:${user.id}`, 120, 60_000) : await hitRateLimit(`voix:fr:ip:${clientIp(await headers())}`, 30, 60_000);
  if (!hit.allowed) return json({ error: "Trop de demandes de lecture. Réessayez dans une minute." }, 429);

  const parts = frenchParts(text);
  const piece = parts[part];
  if (!piece) return json({ error: "Demande invalide." }, 400);
  const budget = user ? async () => (await hitRateLimit(`voix:fr:day:${user.id}`, NEW_CLIPS_PER_DAY, DAY_MS)).allowed : undefined;
  const id = await frenchClip(config, piece, budget);
  if (!id) return json({ error: "La voix du serveur n'est pas disponible." }, 503);
  return json({ clip: user ? `/api/langues/audio/${id}` : publicClipUrl(id), parts: parts.length });
}
