import { loadClassReportCards } from "@/lib/pdf/data/report-cards";
import { reportCardPdf } from "@/lib/pdf/documents/report-card";
import { documentReference, pdfFileName } from "@/lib/pdf/format";
import { exportPdf } from "@/lib/pdf/respond";

// Report cards of a whole class for a period, one page per student, for
// staff allowed to export report cards (the right of the CSV export).
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const classroomId = sp.get("classe") ?? "";
  const periodId = sp.get("periode") ?? "";
  return exportPdf({
    permission: "report_card:export",
    resource: "report_card",
    load: (user) => loadClassReportCards(user, classroomId, periodId),
    build: ({ classroom, period, items, issuer }, ctx) => {
      const base = { generatedAt: ctx.generatedAt, generatedBy: ctx.generatedBy, issuer, title: "Bulletin de notes", subtitle: `${period.name} · ${classroom.academicYear.label}` };
      const batchRef = documentReference("BUL", ctx.generatedAt, classroom.id, period.id, "classe");
      const pages = items.map((data) => ({ data, meta: { ...base, reference: documentReference("BUL", ctx.generatedAt, data.enrollmentId, period.id, data.mode) } }));
      const published = items.filter((i) => i.mode === "published").length;
      return {
        element: reportCardPdf({ title: `Bulletins de la ${classroom.name}, ${period.name} ${classroom.academicYear.label}`, meta: { ...base, reference: batchRef }, items: pages }),
        kind: "bulletin" as const,
        title: `Bulletins de la ${classroom.name}`,
        fileName: pdfFileName("bulletins", classroom.name, period.name, classroom.academicYear.label),
        reference: batchRef,
        summary: `bulletins de la ${classroom.name}, ${period.name} ${classroom.academicYear.label} (${items.length} élèves, ${published} publiés)`,
        resourceId: classroom.id,
        schoolId: classroom.school.id,
      };
    },
  });
}
