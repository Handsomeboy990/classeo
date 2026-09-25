import { statScopeKey } from "@/features/territory/scope";
import { loadStatistics } from "@/lib/pdf/data/statistics";
import { statisticsPdf } from "@/lib/pdf/documents/statistics";
import { documentReference, pdfFileName } from "@/lib/pdf/format";
import { exportPdf } from "@/lib/pdf/respond";

// Key indicators and breakdown of the user's scope, the PDF twin of the
// statistics CSV export (same permission, same narrowing filters).
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  return exportPdf({
    permission: "statistics:export",
    resource: "statistics",
    load: (user) => loadStatistics(user, sp),
    build: ({ scope, data, issuer, schoolId }, c) => {
      const reference = documentReference("STA", c.generatedAt, statScopeKey(scope));
      const meta = { title: "Statistiques", subtitle: `${data.scopeName} · ${data.yearLabel ?? ""}`.replace(/ · $/, ""), reference, generatedAt: c.generatedAt, generatedBy: c.generatedBy, issuer };
      return {
        element: statisticsPdf(data, meta),
        fileName: pdfFileName("statistiques", data.scopeName, data.yearLabel),
        reference,
        summary: `statistiques ${data.scopeName} (${data.children.length} ${data.childLabel.plural.toLowerCase()})`,
        resourceId: statScopeKey(scope),
        schoolId,
      };
    },
  });
}
