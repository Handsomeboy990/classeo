import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isPublicClip } from "@/lib/voice/clip-token";

// A cached speech clip. It holds text the platform already showed (in
// French, or translated), so any signed in user may read it; the id is
// unguessable. A signed out visitor needs the token handed out with the
// clips of the public texts (lib/voice/clip-token.ts).
export async function GET(request: Request, { params }: RouteContext<"/api/langues/audio/[id]">) {
  const { id } = await params;
  const notFound = () => new Response("Introuvable", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (id.length > 64) return notFound();
  const user = await getCurrentUser();
  if (!user && !isPublicClip(id, new URL(request.url).searchParams.get("t"))) return notFound();
  const file = await db.fileBlob.findFirst({ where: { id, purpose: "tts_audio" }, select: { data: true, mimeType: true } });
  if (!file) return notFound();
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      // Content addressed: the clip never changes.
      "Cache-Control": "private, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
