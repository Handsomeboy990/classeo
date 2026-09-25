import { exportRegistry, registryFilters } from "@/features/teachers/registry";
import { exportCsv } from "@/lib/export";

type Row = Awaited<ReturnType<typeof exportRegistry>>[number];

// Teacher registry of the user's territory: one line per person, with the
// schools of their appointments inside that territory.
export async function GET(request: Request) {
  const filters = registryFilters(Object.fromEntries(new URL(request.url).searchParams));
  return exportCsv<Row>({
    permission: "teacher:export",
    resource: "teacher",
    filename: "classeo-registre-enseignants.csv",
    load: (user) => exportRegistry(user, filters),
    columns: [
      { header: "Nom", value: (r) => r.lastName },
      { header: "Prénoms", value: (r) => r.firstName },
      { header: "Sexe", value: (r) => (r.gender === "F" ? "F" : r.gender === "M" ? "M" : "") },
      { header: "NPI", value: (r) => r.npi },
      { header: "Téléphone", value: (r) => r.phone },
      { header: "Établissements", value: (r) => r.teachers.map((t) => `${t.school.name} (${t.school.commune.name})`).join(", ") },
      { header: "Matricules", value: (r) => r.teachers.map((t) => t.matricule).join(", ") },
      { header: "Spécialités", value: (r) => [...new Set(r.teachers.map((t) => t.specialty).filter(Boolean))].join(", ") },
      { header: "Nombre d'établissements", value: (r) => r._count.teachers },
      { header: "Compte", value: (r) => (r.userId ? "Oui" : "Non") },
    ],
  });
}
