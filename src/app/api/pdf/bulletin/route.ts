import { reportCardIdOf, signableContent } from "@/features/signatures/content";
import { loadReportCard } from "@/lib/pdf/data/report-cards";
import { reportCardPdf } from "@/lib/pdf/documents/report-card";
import { documentReference, pdfFileName } from "@/lib/pdf/format";
import { exportPdf } from "@/lib/pdf/respond";

// Report card of one student for one period: ?inscription=&periode= (staff
// and family), or ?id= for a published card (family space). A family only
// ever reaches the published cards of its own children.
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const reportCardId = sp.get("id");
  const key = reportCardId ? { reportCardId } : { enrollmentId: sp.get("inscription") ?? "", periodId: sp.get("periode") ?? "" };
  return exportPdf({
    permission: "report_card:view",
    resource: "report_card",
    load: (user) => loadReportCard(user, key),
    build: async ({ data, issuer, periodId, schoolId }, ctx) => {
      const s = data.student;
      const reportCardId = data.mode === "published" ? await reportCardIdOf(data.enrollmentId, periodId) : null;
      const reference = documentReference("BUL", ctx.generatedAt, data.enrollmentId, periodId, data.mode);
      const meta = { title: "Bulletin de notes", subtitle: `${data.periodName} · ${data.yearLabel}`, reference, generatedAt: ctx.generatedAt, generatedBy: ctx.generatedBy, issuer };
      return {
        element: reportCardPdf({ title: `Bulletin de notes, ${s.lastName} ${s.firstName}, ${data.periodName} ${data.yearLabel}`, meta, items: [{ data, meta }] }),
        kind: "bulletin" as const,
        title: meta.title,
        // Only a published card can carry the head's signature.
        subjectId: reportCardId ?? data.enrollmentId,
        signable: reportCardId ? { content: await signableContent("bulletin", reportCardId) } : undefined,
        fileName: pdfFileName("bulletin", data.periodName, data.yearLabel, s.lastName, s.firstName),
        reference,
        summary: `bulletin ${data.mode === "preview" ? "(aperçu) " : ""}de ${s.lastName} ${s.firstName}, ${data.periodName} ${data.yearLabel}`,
        resourceId: data.enrollmentId,
        schoolId,
      };
    },
  });
}
