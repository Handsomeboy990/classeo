import type { NextRequest } from "next/server";

import { exportInvoices } from "@/features/fees/queries";
import { INVOICE_STATUS_LABELS } from "@/lib/domain/payments";
import { exportCsv } from "@/lib/export";

// Same filters as the invoices list; rows are scoped to the user.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const filters = {
    q: (sp.get("q") ?? "").trim().slice(0, 100),
    status: sp.get("statut") ?? undefined,
    classe: sp.get("classe") ?? undefined,
  };
  return exportCsv({
    permission: "fee:export",
    resource: "fee",
    filename: `factures-${new Date().toISOString().slice(0, 10)}.csv`,
    load: (user) => exportInvoices(user, filters),
    columns: [
      { header: "Numéro", value: (r) => r.number },
      { header: "Matricule", value: (r) => r.enrollment.student.matricule },
      { header: "Nom", value: (r) => r.enrollment.student.lastName },
      { header: "Prénoms", value: (r) => r.enrollment.student.firstName },
      { header: "Classe", value: (r) => r.enrollment.classroom.name },
      { header: "Montant (FCFA)", value: (r) => r.totalAmount },
      { header: "Payé (FCFA)", value: (r) => r.paidAmount },
      { header: "Reste (FCFA)", value: (r) => Math.max(0, r.totalAmount - r.paidAmount) },
      { header: "Émise le", value: (r) => r.issueDate.toISOString().slice(0, 10) },
      { header: "Échéance finale", value: (r) => r.dueDate.toISOString().slice(0, 10) },
      { header: "Statut", value: (r) => INVOICE_STATUS_LABELS[r.effectiveStatus] },
    ],
  });
}
