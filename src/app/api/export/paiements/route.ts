import type { NextRequest } from "next/server";

import { exportPayments } from "@/features/payments/queries";
import { PAYMENT_METHOD_LABELS } from "@/lib/domain/payments";
import { exportCsv } from "@/lib/export";

// Same filters as the payments list; rows are scoped to the user.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const filters = { q: (sp.get("q") ?? "").trim().slice(0, 100), method: sp.get("mode") ?? undefined };
  return exportCsv({
    permission: "payment:export",
    resource: "payment",
    filename: `paiements-${new Date().toISOString().slice(0, 10)}.csv`,
    load: (user) => exportPayments(user, filters),
    columns: [
      { header: "Référence", value: (r) => r.reference },
      { header: "Date", value: (r) => r.paidAt.toISOString().slice(0, 10) },
      { header: "Facture", value: (r) => r.invoice.number },
      { header: "Matricule", value: (r) => r.invoice.enrollment.student.matricule },
      { header: "Élève", value: (r) => `${r.invoice.enrollment.student.lastName} ${r.invoice.enrollment.student.firstName}` },
      { header: "Classe", value: (r) => r.invoice.enrollment.classroom.name },
      { header: "Montant (FCFA)", value: (r) => r.amount },
      { header: "Mode", value: (r) => PAYMENT_METHOD_LABELS[r.method] },
      { header: "Référence de transaction", value: (r) => r.transactionId ?? "" },
      { header: "Saisi par", value: (r) => `${r.recordedBy.firstName} ${r.recordedBy.lastName}` },
    ],
  });
}
