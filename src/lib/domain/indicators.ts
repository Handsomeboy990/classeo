// Education indicators computed from raw counts. The same functions serve the
// nation, a department, a commune, a school and a class, so a figure means the
// same thing at every level of the territory.

export type RawCounts = {
  schools: number;
  activeSchools: number;
  enrollments: number; // active enrollments, current year
  girls: number;
  disabled: number;
  teachers: number; // active teachers
  classes: number; // current year classes
  attendanceRecords: number; // half days recorded, current year
  absences: number; // half days ABSENT or EXCUSED
  resultStudents: number; // students with a yearly average last year
  passed: number; // yearly average >= 10
  averageSum: number; // sum of yearly averages
  pendingRequests: number;
};

export type Indicators = RawCounts & {
  girlsShare: number | null;
  disabledShare: number | null;
  studentsPerTeacher: number | null;
  averageClassSize: number | null;
  absenceRate: number | null;
  passRate: number | null;
  meanAverage: number | null;
};

export const PASS_MARK = 10;

export function emptyCounts(): RawCounts {
  return {
    schools: 0,
    activeSchools: 0,
    enrollments: 0,
    girls: 0,
    disabled: 0,
    teachers: 0,
    classes: 0,
    attendanceRecords: 0,
    absences: 0,
    resultStudents: 0,
    passed: 0,
    averageSum: 0,
    pendingRequests: 0,
  };
}

export function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

export function addCounts(a: RawCounts, b: Partial<RawCounts>): RawCounts {
  const out = { ...a };
  for (const key of Object.keys(out) as (keyof RawCounts)[]) out[key] += b[key] ?? 0;
  return out;
}

export function sumCounts(list: Partial<RawCounts>[]): RawCounts {
  return list.reduce<RawCounts>((acc, c) => addCounts(acc, c), emptyCounts());
}

export function computeIndicators(c: RawCounts): Indicators {
  return {
    ...c,
    girlsShare: ratio(c.girls, c.enrollments),
    disabledShare: ratio(c.disabled, c.enrollments),
    studentsPerTeacher: ratio(c.enrollments, c.teachers),
    averageClassSize: ratio(c.enrollments, c.classes),
    absenceRate: ratio(c.absences, c.attendanceRecords),
    passRate: ratio(c.passed, c.resultStudents),
    meanAverage: ratio(c.averageSum, c.resultStudents),
  };
}

// Indicators offered for sorting and charting, with their display format and
// whether a higher value is the better one.
export type IndicatorKey =
  | "enrollments"
  | "schools"
  | "girlsShare"
  | "disabled"
  | "teachers"
  | "studentsPerTeacher"
  | "averageClassSize"
  | "absenceRate"
  | "passRate"
  | "meanAverage"
  | "pendingRequests";

export type IndicatorFormat = "number" | "percent" | "decimal" | "average";

export const INDICATORS: Record<IndicatorKey, { label: string; short: string; format: IndicatorFormat; higherIsBetter: boolean | null }> = {
  enrollments: { label: "Élèves inscrits", short: "Élèves", format: "number", higherIsBetter: null },
  schools: { label: "Établissements", short: "Établ.", format: "number", higherIsBetter: null },
  girlsShare: { label: "Part des filles", short: "Filles", format: "percent", higherIsBetter: null },
  disabled: { label: "Élèves en situation de handicap", short: "Handicap", format: "number", higherIsBetter: null },
  teachers: { label: "Enseignants", short: "Enseignants", format: "number", higherIsBetter: null },
  studentsPerTeacher: { label: "Élèves par enseignant", short: "Élèves/ens.", format: "decimal", higherIsBetter: false },
  averageClassSize: { label: "Effectif moyen par classe", short: "Taille classe", format: "decimal", higherIsBetter: false },
  absenceRate: { label: "Taux d'absence", short: "Absence", format: "percent", higherIsBetter: false },
  passRate: { label: "Taux de réussite (année précédente)", short: "Réussite", format: "percent", higherIsBetter: true },
  meanAverage: { label: "Moyenne générale (année précédente)", short: "Moyenne", format: "average", higherIsBetter: true },
  pendingRequests: { label: "Demandes en attente", short: "Demandes", format: "number", higherIsBetter: false },
};

export const INDICATOR_KEYS = Object.keys(INDICATORS) as IndicatorKey[];

export function isIndicatorKey(value: unknown): value is IndicatorKey {
  return typeof value === "string" && value in INDICATORS;
}

// Sorts rows by an indicator. Missing values always go last, whatever the
// direction, so a territory without data never tops a ranking. Ties keep a
// stable alphabetical order.
export function sortByIndicator<T extends { name: string; indicators: Indicators }>(rows: T[], key: IndicatorKey, direction: "asc" | "desc" = "desc"): T[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = a.indicators[key];
    const vb = b.indicators[key];
    if (va === null && vb === null) return a.name.localeCompare(b.name, "fr");
    if (va === null) return 1;
    if (vb === null) return -1;
    if (va !== vb) return (va - vb) * sign;
    return a.name.localeCompare(b.name, "fr");
  });
}
