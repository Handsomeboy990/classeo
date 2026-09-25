import { loadTranscript } from "@/lib/pdf/data/school";
import { transcriptPdf } from "@/lib/pdf/documents/school";
import { documentReference, pdfFileName } from "@/lib/pdf/format";
import { exportPdf } from "@/lib/pdf/respond";

// Term transcript of a student: every grade of the running period.
export async function GET(_request: Request, ctx: RouteContext<"/api/pdf/releve/[studentId]">) {
  const { studentId } = await ctx.params;
  return exportPdf({
    permission: "grade:view",
    resource: "grade",
    load: (user) => loadTranscript(user, studentId),
    build: ({ data, enrollmentId, periodId, schoolId, issuer }, c) => {
      const s = data.student;
      const reference = documentReference("REL", c.generatedAt, enrollmentId, periodId);
      const meta = { title: "Relevé de notes", subtitle: `${data.periodName} · ${data.yearLabel}`, reference, generatedAt: c.generatedAt, generatedBy: c.generatedBy, issuer };
      return {
        element: transcriptPdf(data, meta),
        fileName: pdfFileName("releve-de-notes", data.periodName, s.lastName, s.firstName),
        reference,
        summary: `relevé de notes de ${s.lastName} ${s.firstName}, ${data.periodName} ${data.yearLabel}`,
        resourceId: enrollmentId,
        schoolId,
      };
    },
  });
}
