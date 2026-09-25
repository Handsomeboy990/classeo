import { loadInvoice } from "@/lib/pdf/data/payments";
import { invoicePdf } from "@/lib/pdf/documents/payments";
import { pdfFileName } from "@/lib/pdf/format";
import { exportPdf } from "@/lib/pdf/respond";

// Invoice with its lines, installments and payments received.
export async function GET(_request: Request, ctx: RouteContext<"/api/pdf/facture/[id]">) {
  const { id } = await ctx.params;
  return exportPdf({
    permission: "fee:view",
    resource: "fee",
    load: (user) => loadInvoice(user, id),
    build: ({ id: invoiceId, data, issuer, schoolId }, c) => {
      const meta = { title: "Facture", subtitle: `Année scolaire ${data.yearLabel}`, reference: data.number, generatedAt: c.generatedAt, generatedBy: c.generatedBy, issuer };
      return {
        element: invoicePdf(data, meta),
        kind: "facture" as const,
        title: meta.title,
        fileName: pdfFileName("facture", data.number, data.student.lastName, data.student.firstName),
        reference: data.number,
        summary: `facture ${data.number} de ${data.student.lastName} ${data.student.firstName}`,
        resourceId: invoiceId,
        schoolId,
      };
    },
  });
}
