import { actionLabel, auditFilters, exportAudit, resourceLabel } from "@/features/audit/queries";
import { displayIp } from "@/features/connections/ip";
import { can } from "@/lib/auth/authorize";
import { exportCsv } from "@/lib/export";

type Row = Awaited<ReturnType<typeof exportAudit>>[number];

// Activity log of the user's scope with the page filters, 10 000 rows max.
export async function GET(request: Request) {
  const filters = auditFilters(Object.fromEntries(new URL(request.url).searchParams));
  // Full addresses for the accounts holding connection_ip:view only.
  let fullIp = false;
  return exportCsv<Row>({
    permission: "audit:export",
    resource: "audit",
    filename: "classeo-journal.csv",
    load: (user) => {
      fullIp = can(user, "connection_ip:view");
      return exportAudit(user, filters);
    },
    columns: [
      { header: "Date (UTC)", value: (r) => r.createdAt.toISOString() },
      { header: "Utilisateur", value: (r) => (r.user ? `${r.user.firstName} ${r.user.lastName}` : "") },
      { header: "E-mail", value: (r) => r.user?.email ?? "" },
      { header: "Rôle", value: (r) => r.user?.role.name ?? "" },
      { header: "Action", value: (r) => actionLabel(r.action) },
      { header: "Ressource", value: (r) => resourceLabel(r.resource) },
      { header: "Identifiant", value: (r) => r.resourceId },
      { header: "Détail", value: (r) => r.summary },
      { header: "Adresse IP", value: (r) => (r.ip ? displayIp(r.ip, fullIp) : "") },
    ],
  });
}
