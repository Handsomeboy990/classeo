import { loadTransferCertificate } from "@/lib/pdf/data/transfers";
import { transferCertificatePdf } from "@/lib/pdf/documents/attestation";
import { documentReference, pdfFileName } from "@/lib/pdf/format";
import { exportPdf } from "@/lib/pdf/respond";

// Certificat de radiation (exeat) of an accepted school change, in the name
// of the school the pupil left: both schools, the family and the territory
// above them may download it.
export async function GET(_request: Request, ctx: RouteContext<"/espace/transferts/[id]/certificat">) {
  const { id } = await ctx.params;
  return exportPdf({
    permission: "student:view",
    resource: "transfer",
    load: (user) => loadTransferCertificate(user, id),
    build: ({ transferId, data, schoolId, issuer }, c) => {
      const s = data.student;
      const reference = documentReference("EXE", c.generatedAt, transferId);
      const meta = { title: "Certificat de radiation", subtitle: `Exeat · année scolaire ${data.yearLabel}`, reference, generatedAt: c.generatedAt, generatedBy: c.generatedBy, issuer };
      return {
        element: transferCertificatePdf(data, meta),
        fileName: pdfFileName("certificat-de-radiation", data.yearLabel, s.lastName, s.firstName),
        reference,
        summary: `certificat de radiation (exeat) de ${s.lastName} ${s.firstName}, vers ${data.destination.name}`,
        resourceId: transferId,
        schoolId,
        // Registered like every document: reference, QR code, public check.
        kind: "radiation" as const,
        title: `Certificat de radiation (exeat) de ${s.lastName} ${s.firstName}`,
        subjectId: transferId,
      };
    },
  });
}
