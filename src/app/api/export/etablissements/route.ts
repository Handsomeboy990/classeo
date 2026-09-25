import { CYCLE_LABELS, SECTOR_LABELS } from "@/features/schools/labels";
import { exportSchools, schoolFilters } from "@/features/schools/queries";
import { exportCsv } from "@/lib/export";

type Row = Awaited<ReturnType<typeof exportSchools>>[number];

// Schools of the user's scope with the same filters as the list page.
export async function GET(request: Request) {
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const filters = schoolFilters(sp);
  return exportCsv<Row>({
    permission: "school:export",
    resource: "school",
    filename: "classeo-etablissements.csv",
    load: (user) => exportSchools(user, filters),
    columns: [
      { header: "Code", value: (s) => s.code },
      { header: "Nom", value: (s) => s.name },
      { header: "Département", value: (s) => s.commune.department.name },
      { header: "Commune", value: (s) => s.commune.name },
      { header: "Secteur", value: (s) => SECTOR_LABELS[s.sector] },
      { header: "Cycle", value: (s) => CYCLE_LABELS[s.cycle] },
      { header: "Statut", value: (s) => (s.isActive ? "Actif" : "Désactivé") },
      { header: "Adresse", value: (s) => s.address },
      { header: "Téléphone", value: (s) => s.phone },
      { header: "E-mail", value: (s) => s.email },
    ],
  });
}
