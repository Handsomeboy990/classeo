import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

// A cached speech clip. It holds a translation of text the platform already
// showed, so any signed in user may read it; the id is unguessable.
export async function GET(_request: Request, { params }: RouteContext<"/api/langues/audio/[id]">) {
  const { id } = await params;
  const notFound = () => new Response("Introuvable", { status: 404, headers: { "Cache-Control": "no-store" } });
  const user = await getCurrentUser();
  if (!user || id.length > 64) return notFound();
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
