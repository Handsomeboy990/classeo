import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// A cached speech clip is served to signed in users only, except the clips
// of the public texts: their address carries a token, an HMAC of the clip
// id, handed out by the speech routes to a signed out visitor once the text
// was found on the public list. The token never expires; the clip holds a
// text already public.

function sign(id: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return createHmac("sha256", secret).update(`tts:${id}`).digest("base64url").slice(0, 32);
}

export function publicClipUrl(id: string) {
  return `/api/langues/audio/${id}?t=${sign(id)}`;
}

export function isPublicClip(id: string, token: string | null) {
  if (!token) return false;
  const expected = Buffer.from(sign(id));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
