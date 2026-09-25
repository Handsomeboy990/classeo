import { enrollmentWhere, schoolWhere } from "@/lib/auth/scope";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

// Serves an uploaded file after checking the reader may see it. Unknown ids
// and refused reads get the same 404, so ids cannot be probed.
export async function GET(_request: Request, { params }: RouteContext<"/api/files/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const notFound = () => new Response("Introuvable", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!user || id.length > 64) return notFound();

  const file = await db.fileBlob.findUnique({ where: { id }, select: { id: true, purpose: true, mimeType: true, data: true, ownerUserId: true, fileName: true } });
  if (!file) return notFound();

  let allowed = false;
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
      allowed = (await db.documentRequestFile.count({ where: { fileId: id, request: { school: schoolWhere(user) } } })) > 0;
      break;
    case "payment_proof":
      allowed = (await db.paymentDeclaration.count({ where: { proofFileId: id, invoice: { enrollment: enrollmentWhere(user) } } })) > 0;
      break;
  }
  if (!allowed) return notFound();

  const headers: Record<string, string> = {
    "Content-Type": file.mimeType,
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `${file.mimeType === "application/pdf" ? "attachment" : "inline"}; filename="${encodeURIComponent(file.fileName)}"`,
  };
  // An SVG is shown as an image, never run as a document.
  if (file.mimeType === "image/svg+xml") headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
  return new Response(new Uint8Array(file.data), { headers });
}
