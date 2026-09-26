import { loadSchoolPayslip, payslipDocument } from "@/lib/pdf/data/payroll";
import { exportPdf } from "@/lib/pdf/respond";

// A payslip printed by the school that issued it.
export async function GET(_request: Request, ctx: RouteContext<"/api/pdf/bulletin-paie/[id]">) {
  const { id } = await ctx.params;
  return exportPdf({
    permission: "payroll:export",
    resource: "payroll",
    load: (user) => loadSchoolPayslip(user, id),
    build: (p, c) => payslipDocument(p, c.generatedAt, c.generatedBy),
  });
}
