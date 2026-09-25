import { classPreview } from "@/features/report-cards/queries";
import { mention } from "@/lib/domain/grades";
import { exportCsv } from "@/lib/export";

type Card = NonNullable<Awaited<ReturnType<typeof classPreview>>>["cards"][number] & { published: boolean };
type Col = { header: string; value: (r: Card) => unknown };

const fmt = (n: number | null) => (n === null ? "" : n.toFixed(2).replace(".", ","));

// Report cards of a class for a period, computed from the grades, with their
// publication state. Subject columns are known once the class is loaded;
// exportCsv reads the columns only after load() has run.
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const classroomId = sp.get("classe") ?? "";
  const periodId = sp.get("periode") ?? "";
  const columns: Col[] = [];
  return exportCsv<Card>({
    permission: "report_card:export",
    resource: "report_card",
    filename: "bulletins.csv",
    columns,
    load: async (user) => {
      const preview = classroomId && periodId ? await classPreview(user, classroomId, periodId) : null;
      if (!preview) return [];
      columns.push(
        { header: "Rang", value: (c) => c.rank ?? "" },
        { header: "Matricule", value: (c) => c.student.matricule },
        { header: "Élève", value: (c) => c.name },
        { header: "Classe", value: () => preview.classroom.name },
        ...preview.subjects.map((s, i) => ({ header: `${s.subject} (coef. ${s.coefficient})`, value: (c: Card) => fmt(c.lines[i]!.average) })),
        { header: "Moyenne générale", value: (c) => fmt(c.generalAverage) },
        { header: "Mention", value: (c) => mention(c.generalAverage)?.label ?? "" },
        { header: "Appréciation", value: (c) => c.appreciation ?? "" },
        { header: "Publié", value: (c) => (c.published ? "Oui" : "Non") },
      );
      return [...preview.cards].sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity)).map((c) => ({ ...c, published: preview.published.has(c.enrollmentId) }));
    },
  });
}
