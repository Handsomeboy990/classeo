import { canReadFamilyFile } from "@/features/family-documents/access";
import { conversationWhere } from "@/features/messages/queries";
import { enrollmentWhere, schoolWhere } from "@/lib/auth/scope";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { contentDisposition, parseRange } from "@/lib/http-files";

// Serves an uploaded file after checking the reader may see it. Unknown ids
// and refused reads get the same 404, so ids cannot be probed. The type sent
// is the one sniffed at upload, never what the uploader declared.
export async function GET(request: Request, { params }: RouteContext<"/api/files/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const notFound = () => new Response("Introuvable", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!user || id.length > 64) return notFound();

  const file = await db.fileBlob.findUnique({ where: { id }, select: { id: true, purpose: true, mimeType: true, data: true, ownerUserId: true, fileName: true } });
  if (!file) return notFound();

  let allowed = false;
  // Health pieces are never kept in a cache, even the browser's.
  let sensitive = false;
  switch (file.purpose) {
    case "school_logo":
      allowed = true;
      break;
    case "student_photo":
      allowed = (await db.student.count({ where: { photoFileId: id, enrollments: { some: enrollmentWhere(user) } } })) > 0;
      break;
    case "signature":
    case "stamp":
      allowed = file.ownerUserId === user.id;
      break;
    case "document":
      // Documents schools send to their authorities: staff only, never a
      // family account whose scope reaches the school through a child.
      allowed = user.scope.level !== "SELF" && (await db.documentRequestFile.count({ where: { fileId: id, request: { school: schoolWhere(user) } } })) > 0;
      break;
    case "payment_proof":
      allowed = (await db.paymentDeclaration.count({ where: { proofFileId: id, invoice: { enrollment: enrollmentWhere(user) } } })) > 0;
      break;
    case "voice_note":
      // The participants of the conversation, or the staff of a
      // participating institution: the same filter as the thread.
      allowed = (await db.message.count({ where: { audioFileId: id, conversation: conversationWhere(user) } })) > 0;
      break;
    case "family_document": {
      const access = await canReadFamilyFile(user, id);
      allowed = access.allowed;
      sensitive = access.health;
      break;
    }
  }
  if (!allowed) return notFound();

  const headers: Record<string, string> = {
    "Content-Type": file.mimeType,
    "Cache-Control": sensitive ? "private, no-store" : "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": contentDisposition(file.fileName, file.mimeType === "application/pdf" ? "attachment" : "inline"),
    // Audio players (Safari first) read media by byte ranges.
    "Accept-Ranges": "bytes",
  };
  // An SVG is shown as an image, never run as a document.
  if (file.mimeType === "image/svg+xml") headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

  const bytes = new Uint8Array(file.data);
  const range = parseRange(request.headers.get("range"), bytes.byteLength);
  if (range === "invalid") return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${bytes.byteLength}` } });
  if (range) {
    return new Response(bytes.slice(range.start, range.end + 1), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${range.start}-${range.end}/${bytes.byteLength}`, "Content-Length": String(range.end - range.start + 1) },
    });
  }
  return new Response(bytes, { headers: { ...headers, "Content-Length": String(bytes.byteLength) } });
}
