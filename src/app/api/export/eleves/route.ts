import { ENROLLMENT_STATUS_LABELS, GENDER_LABELS, shortDate } from "@/features/students/labels";
import { listStudents } from "@/features/students/queries";
import { exportCsv } from "@/lib/export";

type Row = Awaited<ReturnType<typeof listStudents>>["rows"][number];

const STATUSES = ["ACTIVE", "WITHDRAWN", "TRANSFERRED", "ALL"] as const;

// Same filters as the student list; the scope is applied by listStudents.
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const q = (sp.get("q") ?? "").trim().slice(0, 100);
  const classroomId = sp.get("classe") || undefined;
  const status = STATUSES.find((s) => s === sp.get("statut")) ?? "ACTIVE";
  return exportCsv<Row>({
    permission: "student:export",
    resource: "student",
    filename: "eleves.csv",
    load: async (user) => (await listStudents(user, { q, classroomId, status, skip: 0, take: 5000 })).rows,
    columns: [
      { header: "Matricule", value: (r) => r.student.matricule },
      { header: "Nom", value: (r) => r.student.lastName },
      { header: "Prénoms", value: (r) => r.student.firstName },
      { header: "Sexe", value: (r) => GENDER_LABELS[r.student.gender] },
      { header: "Date de naissance", value: (r) => shortDate(r.student.birthDate) },
      { header: "Classe", value: (r) => r.classroom.name },
      { header: "Établissement", value: (r) => r.school.name },
      { header: "Redoublant", value: (r) => (r.isRepeating ? "Oui" : "Non") },
      { header: "Statut", value: (r) => ENROLLMENT_STATUS_LABELS[r.status] },
      { header: "Parent principal", value: (r) => (r.student.guardians[0] ? `${r.student.guardians[0].guardian.firstName} ${r.student.guardians[0].guardian.lastName}` : "") },
      { header: "Téléphone du parent", value: (r) => r.student.guardians[0]?.guardian.phone ?? "" },
    ],
  });
}
