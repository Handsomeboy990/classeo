import { displayIp } from "@/features/connections/ip";
import { exportConnections } from "@/features/connections/queries";
import { connectionFilters, OUTCOME_LABELS } from "@/features/connections/scope";
import { DEVICE_LABELS, type DeviceKind } from "@/features/connections/user-agent";
import { can } from "@/lib/auth/authorize";
import { exportCsv } from "@/lib/export";

type Row = Awaited<ReturnType<typeof exportConnections>>[number];

// Recent connections of the viewer's scope with the page filters, 10 000
// rows max. Full IP addresses only with connection_ip:view.
export async function GET(request: Request) {
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  let fullIp = false;
  return exportCsv<Row>({
    permission: "connection:export",
    resource: "connection",
    filename: "classeo-connexions.csv",
    load: (user) => {
      fullIp = can(user, "connection_ip:view");
      return exportConnections(user, connectionFilters(sp, user.scope.level));
    },
    columns: [
      { header: "Date (UTC)", value: (r) => r.createdAt.toISOString() },
      { header: "Résultat", value: (r) => OUTCOME_LABELS[r.outcome] },
      { header: "Compte", value: (r) => (r.user ? `${r.user.firstName} ${r.user.lastName}` : "") },
      { header: "Identifiant", value: (r) => r.user?.username ?? "" },
      { header: "Rôle", value: (r) => r.user?.role.name ?? r.roleCode ?? "" },
      { header: "Département", value: (r) => r.department ?? "" },
      { header: "Commune", value: (r) => r.commune ?? "" },
      { header: "Appareil", value: (r) => (r.device ? (DEVICE_LABELS[r.device as DeviceKind] ?? r.device) : "") },
      { header: "Navigateur", value: (r) => r.browser ?? "" },
      { header: "Système", value: (r) => r.os ?? "" },
      { header: "Adresse IP", value: (r) => (r.ip ? displayIp(r.ip, fullIp) : "") },
      { header: "Première connexion", value: (r) => (r.firstTime ? "oui" : "") },
      { header: "Page de démonstration", value: (r) => (r.demo ? "oui" : "") },
    ],
  });
}
