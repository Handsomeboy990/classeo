import { exportUsers, userFilters } from "@/features/users/queries";
import { exportCsv } from "@/lib/export";

type Row = Awaited<ReturnType<typeof exportUsers>>[number];

// Accounts of the user's scope. The select is explicit: no password hash, no
// lockout counters.
export async function GET(request: Request) {
  const filters = userFilters(Object.fromEntries(new URL(request.url).searchParams));
  return exportCsv<Row>({
    permission: "user:export",
    resource: "user",
    filename: "classeo-utilisateurs.csv",
    load: (user) => exportUsers(user, filters),
    columns: [
      { header: "Prénom", value: (u) => u.firstName },
      { header: "Nom", value: (u) => u.lastName },
      { header: "Identifiant", value: (u) => u.username },
      { header: "E-mail", value: (u) => u.email },
      { header: "Téléphone", value: (u) => u.phone },
      { header: "Rôle", value: (u) => u.role.name },
      { header: "Périmètre", value: (u) => u.school?.name ?? u.commune?.name ?? u.department?.name ?? (u.scopeLevel === "NATIONAL" ? "Bénin" : "Personnel") },
      { header: "Statut", value: (u) => (u.isActive ? "Actif" : "Désactivé") },
      { header: "Dernière connexion", value: (u) => u.lastLoginAt?.toISOString() ?? "" },
      { header: "Créé le", value: (u) => u.createdAt.toISOString() },
    ],
  });
}
