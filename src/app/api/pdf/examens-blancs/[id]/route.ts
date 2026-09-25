import { examResults, getExam } from "@/features/mock-exams/queries";
import { resultsSheetPdf } from "@/features/mock-exams/pdf";
import { isEnabled } from "@/lib/features";
import { validId } from "@/lib/pdf/data/common";
import { beninDate, documentReference, pdfFileName } from "@/lib/pdf/format";
import type { Issuer } from "@/lib/pdf/layout";
import { exportPdf } from "@/lib/pdf/respond";

// Results sheet of a running or closed mock exam: school ranking, subject
// averages and the candidates the account may see by name.
export async function GET(_request: Request, ctx: RouteContext<"/api/pdf/examens-blancs/[id]">) {
  const { id } = await ctx.params;
  if (!(await isEnabled("exams.mock"))) return new Response("Document introuvable", { status: 404, headers: { "Cache-Control": "no-store" } });
  return exportPdf({
    permission: "mock_exam:export",
    resource: "mock_exam",
    load: async (user) => {
      if (!validId(id)) return null;
      const exam = await getExam(user, id);
      if (!exam || (exam.status !== "APPROVED" && exam.status !== "CLOSED")) return null;
      const results = await examResults(user, exam);
      const organizer = exam.participants.find((p) => p.isOrganizer)?.school;
      const issuer: Issuer =
        exam.organizerLevel === "SCHOOL" && organizer
          ? { kind: "school", name: organizer.name, code: organizer.code, place: `${organizer.commune.name}, ${organizer.commune.department.name}` }
          : { kind: "ministry", name: exam.organizerName, detail: "Examens blancs des classes d'examen" };
      const dates = exam.startDate.getTime() === exam.endDate.getTime() ? `le ${beninDate(exam.startDate)}` : `du ${beninDate(exam.startDate)} au ${beninDate(exam.endDate)}`;
      return { exam, results, issuer, dates };
    },
    build: ({ exam, results, issuer, dates }, c) => {
      const reference = documentReference("EXB", c.generatedAt, exam.id, c.user.id);
      const meta = { title: "Relevé des résultats", subtitle: `Examen blanc, ${exam.title}`, reference, generatedAt: c.generatedAt, generatedBy: c.generatedBy, issuer };
      return {
        element: resultsSheetPdf({ exam, results, dates }, meta),
        fileName: pdfFileName("examen-blanc", exam.title, exam.level?.name),
        reference,
        summary: `relevé de l'examen blanc « ${exam.title} » (${results.named.length} candidats nommés)`,
        resourceId: exam.id,
        schoolId: c.user.scope.schoolId,
        // Registered like every document: reference, QR code, public check.
        kind: "examen_blanc" as const,
        title: `Relevé de l'examen blanc « ${exam.title} »`,
        subjectId: exam.id,
      };
    },
  });
}
