import { loadAttendanceSheet } from "@/lib/pdf/data/school";
import { attendanceSheetPdf } from "@/lib/pdf/documents/school";
import { documentReference, pdfFileName } from "@/lib/pdf/format";
import { exportPdf } from "@/lib/pdf/respond";

// Attendance sheet of a class for ?date=YYYY-MM-DD (today by default).
export async function GET(request: Request, ctx: RouteContext<"/api/pdf/fiche-appel/[classroomId]">) {
  const { classroomId } = await ctx.params;
  const date = new URL(request.url).searchParams.get("date");
  return exportPdf({
    permission: "attendance:view",
    resource: "attendance",
    load: (user) => loadAttendanceSheet(user, classroomId, date),
    build: ({ id, date: day, data, schoolId, issuer }, c) => {
      const reference = documentReference("APL", c.generatedAt, id, day);
      const meta = { title: "Fiche d'appel", subtitle: `${data.classroom} · ${data.yearLabel}`, reference, generatedAt: c.generatedAt, generatedBy: c.generatedBy, issuer };
      return {
        element: attendanceSheetPdf(data, meta),
        kind: "fiche_appel" as const,
        title: meta.title,
        fileName: pdfFileName("fiche-appel", data.classroom, day),
        reference,
        summary: `fiche d'appel de la ${data.classroom} du ${day}`,
        resourceId: id,
        schoolId,
      };
    },
  });
}
