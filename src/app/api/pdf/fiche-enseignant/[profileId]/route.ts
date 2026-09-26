import { getTeacherFile } from "@/features/teachers/file";
import { teacherFilePdf } from "@/lib/pdf/documents/teacher-file";
import { documentReference, pdfFileName } from "@/lib/pdf/format";
import type { Issuer } from "@/lib/pdf/layout";
import { exportPdf, type PdfUser } from "@/lib/pdf/respond";

// The service that issues the file: the viewer's level of the ministry.
function issuerOf(user: PdfUser): Issuer {
  switch (user.scope.level) {
    case "DEPARTMENT":
      return { kind: "ministry", name: `Direction départementale, ${user.scope.label}` };
    case "COMMUNE":
      return { kind: "ministry", name: `Circonscription scolaire, ${user.scope.label}` };
    default:
      return { kind: "ministry", name: "Niveau national" };
  }
}

// Fiche enseignant: the teacher file page as a registered PDF, with the same
// access rule (getTeacherFile answers null outside the scope: 404).
export async function GET(_request: Request, ctx: RouteContext<"/api/pdf/fiche-enseignant/[profileId]">) {
  const { profileId } = await ctx.params;
  return exportPdf({
    permission: "teacher:view",
    resource: "teacher",
    load: async (user) => {
      const file = await getTeacherFile(user, profileId);
      return file ? { file, issuer: issuerOf(user) } : null;
    },
    build: ({ file, issuer }, c) => {
      const p = file.profile;
      const reference = documentReference("ENS", c.generatedAt, p.id, c.user.id);
      const meta = { title: "Fiche enseignant", subtitle: file.year ? `Année scolaire ${file.year.label}` : null, reference, generatedAt: c.generatedAt, generatedBy: c.generatedBy, issuer };
      return {
        element: teacherFilePdf(file, meta),
        kind: "fiche_enseignant" as const,
        title: meta.title,
        subjectId: p.id,
        fileName: pdfFileName("fiche-enseignant", p.lastName, p.firstName),
        reference,
        summary: `fiche enseignant de ${p.lastName} ${p.firstName}`,
        resourceId: p.id,
        schoolId: null,
      };
    },
  });
}
