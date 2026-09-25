import { loadCertificate } from "@/lib/pdf/data/school";
import { certificatePdf } from "@/lib/pdf/documents/school";
import { documentReference, pdfFileName } from "@/lib/pdf/format";
import { exportPdf } from "@/lib/pdf/respond";

// Certificate of enrollment for the active year: school staff for their
// students, a parent for their own children.
export async function GET(_request: Request, ctx: RouteContext<"/api/pdf/attestation/[studentId]">) {
  const { studentId } = await ctx.params;
  return exportPdf({
    permission: "student:view",
    resource: "student",
    load: (user) => loadCertificate(user, studentId),
    build: ({ enrollmentId, data, schoolId, issuer }, c) => {
      const s = data.student;
      const reference = documentReference("ATT", c.generatedAt, enrollmentId);
      const meta = { title: "Attestation de scolarité", subtitle: `Année scolaire ${data.yearLabel}`, reference, generatedAt: c.generatedAt, generatedBy: c.generatedBy, issuer };
      return {
        element: certificatePdf(data, meta),
        fileName: pdfFileName("attestation-de-scolarite", data.yearLabel, s.lastName, s.firstName),
        reference,
        summary: `attestation de scolarité de ${s.lastName} ${s.firstName}, ${data.yearLabel}`,
        resourceId: enrollmentId,
        schoolId,
      };
    },
  });
}
