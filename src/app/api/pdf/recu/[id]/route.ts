import { loadReceipt } from "@/lib/pdf/data/payments";
import { receiptPdf } from "@/lib/pdf/documents/payments";
import { pdfFileName } from "@/lib/pdf/format";
import { exportPdf } from "@/lib/pdf/respond";

// Receipt of one payment. The reference printed is the payment's own
// reference, the one already given to the family.
export async function GET(_request: Request, ctx: RouteContext<"/api/pdf/recu/[id]">) {
  const { id } = await ctx.params;
  return exportPdf({
    permission: "payment:view",
    resource: "payment",
    load: (user) => loadReceipt(user, id),
    build: ({ id: paymentId, data, issuer, schoolId }, c) => {
      const meta = { title: "Reçu de paiement", subtitle: `Facture ${data.invoice.number}`, reference: data.reference, generatedAt: c.generatedAt, generatedBy: c.generatedBy, issuer };
      return {
        element: receiptPdf(data, meta),
        fileName: pdfFileName("recu", data.reference, data.student.lastName, data.student.firstName),
        reference: data.reference,
        summary: `reçu ${data.reference} de ${data.student.lastName} ${data.student.firstName}`,
        resourceId: paymentId,
        schoolId,
      };
    },
  });
}
