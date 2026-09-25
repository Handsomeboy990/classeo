import { loadClassList } from "@/lib/pdf/data/school";
import { classListPdf } from "@/lib/pdf/documents/school";
import { documentReference, pdfFileName } from "@/lib/pdf/format";
import { exportPdf } from "@/lib/pdf/respond";

// Students of a class with matricule, sex, birth date and, for accounts that
// may see parents, the guardian's phone.
export async function GET(_request: Request, ctx: RouteContext<"/api/pdf/liste-de-classe/[classroomId]">) {
  const { classroomId } = await ctx.params;
  return exportPdf({
    permission: "student:view",
    resource: "class",
    load: (user) => loadClassList(user, classroomId),
    build: ({ id, data, schoolId, issuer }, c) => {
      const reference = documentReference("LST", c.generatedAt, id);
      const meta = { title: "Liste de classe", subtitle: `${data.classroom} · ${data.yearLabel}`, reference, generatedAt: c.generatedAt, generatedBy: c.generatedBy, issuer };
      return {
        element: classListPdf(data, meta),
        fileName: pdfFileName("liste-de-classe", data.classroom, data.yearLabel),
        reference,
        summary: `liste de la classe ${data.classroom} (${data.students.length} élèves${data.showPhones ? ", avec téléphones des parents" : ""})`,
        resourceId: id,
        schoolId,
      };
    },
  });
}
