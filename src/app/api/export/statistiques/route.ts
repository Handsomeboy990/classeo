import { formatIndicator } from "@/features/statistics/format";
import { CHILD_LABELS, getStatistics, type ChildRow } from "@/features/statistics/queries";
import { scopeTitle } from "@/features/territory/queries";
import { narrowStatScope } from "@/features/territory/scope";
import { ForbiddenError } from "@/lib/auth/authorize";
import { INDICATORS, type IndicatorKey } from "@/lib/domain/indicators";
import { exportCsv } from "@/lib/export";

const KEYS: IndicatorKey[] = [
  "schools",
  "enrollments",
  "girlsShare",
  "disabled",
  "teachers",
  "studentsPerTeacher",
  "averageClassSize",
  "absenceRate",
  "passRate",
  "meanAverage",
  "pendingRequests",
];

// Indicators of the user's scope (optionally narrowed by department and
// commune), one line per child territory plus a total line.
export async function GET(request: Request) {
  const url = new URL(request.url);
  let level = "";
  try {
    return await exportCsv<ChildRow>({
      permission: "statistics:export",
      resource: "statistics",
      filename: "classeo-statistiques.csv",
      load: async (user) => {
        const { scope } = await narrowStatScope(user, { departmentId: url.searchParams.get("departement"), communeId: url.searchParams.get("commune") });
        const stats = await getStatistics(scope);
        const title = await scopeTitle(scope);
        level = CHILD_LABELS[stats.childLevel].singular;
        return [...stats.children, { id: "total", name: `Total ${title.name}`, indicators: stats.total }];
      },
      columns: [
        { header: "Territoire", value: (r) => r.name },
        ...KEYS.map((k) => ({ header: INDICATORS[k].label, value: (r: ChildRow) => formatIndicator(k, r.indicators[k]) })),
        { header: "Niveau", value: (r) => (r.id === "total" ? "Total" : level) },
      ],
    });
  } catch (error) {
    if (error instanceof ForbiddenError) return new Response("Accès refusé", { status: 403 });
    throw error;
  }
}
