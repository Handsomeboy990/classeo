import { loadOwnPayslip, payslipDocument } from "@/lib/pdf/data/payroll";
import { exportPdf } from "@/lib/pdf/respond";

// A teacher's own payslip, from "Ma paie".
export async function GET(_request: Request, ctx: RouteContext<"/api/pdf/ma-paie/[id]">) {
  const { id } = await ctx.params;
  return exportPdf({
    permission: "payslip:view",
    resource: "payroll",
    load: (user) => loadOwnPayslip(user, id),
    build: (p, c) => payslipDocument(p, c.generatedAt, c.generatedBy),
  });
}
