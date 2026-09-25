import { loadTimetablePdf } from "@/lib/pdf/data/timetable";
import { timetablePdf } from "@/lib/pdf/documents/timetable";
import { documentReference, pdfFileName } from "@/lib/pdf/format";
import { exportPdf } from "@/lib/pdf/respond";

// Week timetable of a class (?classe=), of the signed in teacher, or of a
// teacher of the user's school (?enseignant=), for ?semaine=YYYY-MM-DD.
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  return exportPdf({
    permission: "timetable:view",
    resource: "timetable",
    load: (user) => loadTimetablePdf(user, sp),
    build: ({ subjectId, data, issuer, schoolId }, c) => {
      const week = data.monday.toISOString().slice(0, 10);
      const reference = documentReference("EDT", c.generatedAt, subjectId, week);
      const meta = { title: "Emploi du temps", subtitle: `${data.who}${data.yearLabel ? ` · ${data.yearLabel}` : ""}`, reference, generatedAt: c.generatedAt, generatedBy: c.generatedBy, issuer };
      return {
        element: timetablePdf(data, meta),
        kind: "emploi_du_temps" as const,
        title: meta.title,
        fileName: pdfFileName("emploi-du-temps", data.who, week),
        reference,
        summary: `emploi du temps ${data.who}, semaine du ${week}`,
        resourceId: subjectId,
        schoolId,
      };
    },
  });
}
