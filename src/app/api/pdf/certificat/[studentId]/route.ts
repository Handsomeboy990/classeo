import { signableContent } from "@/features/signatures/content";
import { loadSchoolCertificate } from "@/lib/pdf/data/certificate";
import { schoolCertificatePdf } from "@/lib/pdf/documents/certificate";
import { documentReference, pdfFileName } from "@/lib/pdf/format";
import { exportPdf } from "@/lib/pdf/respond";

// Certificate of schooling (every year spent in the school): school staff
// for their pupils, a parent for their own children. Signed when the head
// signed this content.
export async function GET(_request: Request, ctx: RouteContext<"/api/pdf/certificat/[studentId]">) {
  const { studentId } = await ctx.params;
  return exportPdf({
    permission: "student:view",
    resource: "student",
    load: (user) => loadSchoolCertificate(user, studentId),
    build: async ({ enrollmentId, data, schoolId, issuer }, c) => {
      const s = data.student;
      const reference = documentReference("CER", c.generatedAt, enrollmentId);
      const meta = { title: "Certificat de scolarité", subtitle: `Année scolaire ${data.current.yearLabel}`, reference, generatedAt: c.generatedAt, generatedBy: c.generatedBy, issuer };
      return {
        element: schoolCertificatePdf(data, meta),
        kind: "certificat" as const,
        title: meta.title,
        subjectId: enrollmentId,
        signable: { content: await signableContent("certificat", enrollmentId) },
        fileName: pdfFileName("certificat-de-scolarite", data.current.yearLabel, s.lastName, s.firstName),
        reference,
        summary: `certificat de scolarité de ${s.lastName} ${s.firstName}, ${data.current.yearLabel}`,
        resourceId: enrollmentId,
        schoolId,
      };
    },
  });
}
