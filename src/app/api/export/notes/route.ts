import { getSheetForEntry } from "@/features/grades/queries";
import { computeClassCards } from "@/features/report-cards/compute";
import { classroomWhere } from "@/lib/auth/scope";
import { parseGradeValue } from "@/lib/domain/grade-entry";
import { rankEntries, subjectAverage, type GradeInput } from "@/lib/domain/grades";
import { db } from "@/lib/db";
import { exportCsv } from "@/lib/export";

type Row = { cells: Record<string, unknown> };
type Col = { header: string; value: (r: Row) => unknown };

// Header values must stay ASCII: accents and spaces are folded.
const safeName = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9.-]+/g, "-");

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "" : n.toFixed(2).replace(".", ","));

// ?fiche=<sheetId>: every grade of one sheet with the average and rank.
// ?classe=<id>&periode=<id>: subject averages of a class for a period.
// Columns depend on the data, so load() fills them; exportCsv reads the
// columns and the file name only after load() has run.
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const sheetId = sp.get("fiche");
  const classroomId = sp.get("classe");
  const periodId = sp.get("periode");
  const columns: Col[] = [];
  let filename = "notes.csv";

  return exportCsv<Row>({
    permission: "grade:export",
    resource: "grade",
    get filename() {
      return filename;
    },
    columns,
    load: async (user) => {
      if (sheetId) {
        const data = await getSheetForEntry(user, sheetId);
        if (!data) return [];
        const { sheet, columns: evals, rows } = data;
        filename = safeName(`notes-${sheet.assignment.classroom.name}-${sheet.assignment.subject.name}.csv`);
        const computed = rows.map((r) => {
          const grades: GradeInput[] = [];
          for (const c of evals) {
            const p = parseGradeValue(r.values[c.key] ?? "");
            if (p.ok && p.value !== null) grades.push({ type: c.type, value: p.value, maxValue: 20 });
          }
          return { r, avg: subjectAverage(sheet.formula, grades).average };
        });
        const ranks = rankEntries(computed, (x) => x.avg);
        columns.push(
          { header: "Matricule", value: (x) => x.cells.matricule },
          { header: "Élève", value: (x) => x.cells.name },
          ...evals.map((c) => ({ header: c.label, value: (x: Row) => x.cells[c.key] })),
          { header: "Moyenne", value: (x) => x.cells.avg },
          { header: "Rang", value: (x) => x.cells.rank },
        );
        return computed.map((x) => ({ cells: { matricule: x.r.matricule, name: x.r.name, ...x.r.values, avg: fmt(x.avg), rank: ranks.get(x) ?? "" } }));
      }
      if (!classroomId || !periodId) return [];
      const classroom = await db.classroom.findFirst({ where: { AND: [{ id: classroomId }, classroomWhere(user)] }, select: { id: true, name: true, academicYearId: true } });
      const period = classroom ? await db.schoolPeriod.findFirst({ where: { id: periodId, academicYearId: classroom.academicYearId } }) : null;
      if (!classroom || !period) return [];
      filename = safeName(`moyennes-${classroom.name}-${period.name}.csv`);
      const { cards, subjects } = await computeClassCards(classroom.id, period.id);
      columns.push(
        { header: "Matricule", value: (x) => x.cells.matricule },
        { header: "Élève", value: (x) => x.cells.name },
        ...subjects.map((s, i) => ({ header: `${s.subject} (coef. ${s.coefficient})`, value: (x: Row) => x.cells[`s${i}`] })),
        { header: "Moyenne générale", value: (x) => x.cells.avg },
        { header: "Rang", value: (x) => x.cells.rank },
      );
      return cards.map((c) => ({
        cells: { matricule: c.student.matricule, name: c.name, ...Object.fromEntries(c.lines.map((l, i) => [`s${i}`, fmt(l.average)])), avg: fmt(c.generalAverage), rank: c.rank ?? "" },
      }));
    },
  });
}
