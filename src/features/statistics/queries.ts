import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { cached, tags } from "@/lib/cache";
import { db } from "@/lib/db";
import { computeIndicators, emptyCounts, sumCounts, type Indicators, type RawCounts } from "@/lib/domain/indicators";

import { statScopeKey, type StatScope } from "../territory/scope";

// Statistics engine. Every indicator is computed with the same functions at
// every level of the territory:
// - one SQL query returns raw counts per school for the scope (or per class
//   for a school), with parameters only;
// - lib/domain/indicators turns counts into ratios, summed up the hierarchy,
//   so a national figure is exactly the sum of its departments.
//
// Definitions:
// - enrollments, girls, disabilities: active enrollments of the current year;
// - absence rate: half days recorded ABSENT or EXCUSED over half days recorded
//   in the current year (LATE counts as present);
// - results: previous year. Each student's yearly average is the mean of the
//   published general averages of the three terms; the pass rate is the share
//   of yearly averages >= 10, the mean average is the mean of yearly averages.

export type ChildLevel = "DEPARTMENT" | "COMMUNE" | "SCHOOL" | "CLASS";

// status: set for schools, so a suspended or closed one is flagged.
export type ChildRow = { id: string; name: string; indicators: Indicators; status?: "ACTIVE" | "SUSPENDED" | "CLOSED" };

export type ScopeStatistics = {
  scope: StatScope;
  yearLabel: string | null;
  previousYearLabel: string | null;
  total: Indicators;
  childLevel: ChildLevel;
  children: ChildRow[];
  computedAt: string;
};

type Years = { current: { id: string; label: string } | null; previous: { id: string; label: string } | null };

// The year shown and the year its results come from. By default the active
// year, with the results of the year before (the current one has none yet).
// A past year chosen from the year selector is read with its own results.
export async function yearsFor(yearId: string | null | undefined): Promise<Years> {
  if (!yearId) return loadYears();
  const chosen = await db.academicYear.findUnique({ where: { id: yearId }, select: { id: true, label: true, isActive: true } });
  if (!chosen) return loadYears();
  if (chosen.isActive) return loadYears();
  return { current: { id: chosen.id, label: chosen.label }, previous: { id: chosen.id, label: chosen.label } };
}

export async function loadYears(): Promise<Years> {
  const current = await db.academicYear.findFirst({ where: { isActive: true }, select: { id: true, label: true, startDate: true } });
  const previous = await db.academicYear.findFirst({
    where: current ? { startDate: { lt: current.startDate } } : { isActive: false },
    orderBy: { startDate: "desc" },
    select: { id: true, label: true },
  });
  return { current: current ? { id: current.id, label: current.label } : null, previous };
}

type SchoolCountsRow = {
  id: string;
  name: string;
  communeId: string;
  departmentId: string;
  isActive: boolean;
  status: "ACTIVE" | "SUSPENDED" | "CLOSED";
  enrollments: number;
  girls: number;
  disabled: number;
  teachers: number;
  classes: number;
  attendanceRecords: number;
  absences: number;
  resultStudents: number;
  passed: number;
  averageSum: number;
  pendingRequests: number;
};

function schoolFilter(scope: StatScope): Prisma.Sql {
  switch (scope.level) {
    case "NATIONAL":
      return Prisma.sql`TRUE`;
    case "DEPARTMENT":
      return Prisma.sql`c."departmentId" = ${scope.id}`;
    case "COMMUNE":
      return Prisma.sql`s."communeId" = ${scope.id}`;
    case "SCHOOL":
      return Prisma.sql`s.id = ${scope.id}`;
  }
}

// Raw counts for every school of the scope, in one round trip.
async function schoolCounts(scope: StatScope, years: Years): Promise<SchoolCountsRow[]> {
  const yearId = years.current?.id ?? "";
  const prevId = years.previous?.id ?? "";
  return db.$queryRaw<SchoolCountsRow[]>`
    WITH sc AS (
      SELECT s.id, s.name, s."communeId", c."departmentId", s."isActive", s.status::text AS status
      FROM "School" s JOIN "Commune" c ON c.id = s."communeId"
      WHERE ${schoolFilter(scope)}
    ),
    enr AS (
      SELECT e."schoolId" AS sid, count(*)::int AS total,
             count(*) FILTER (WHERE st.gender = 'F')::int AS girls,
             count(*) FILTER (WHERE cardinality(st.disabilities) > 0)::int AS disabled
      FROM "Enrollment" e JOIN "Student" st ON st.id = e."studentId"
      WHERE e."academicYearId" = ${yearId} AND e.status = 'ACTIVE' AND e."schoolId" IN (SELECT id FROM sc)
      GROUP BY 1
    ),
    tea AS (
      SELECT t."schoolId" AS sid, count(*)::int AS n FROM "Teacher" t
      WHERE t."isActive" AND t."schoolId" IN (SELECT id FROM sc) GROUP BY 1
    ),
    cla AS (
      SELECT k."schoolId" AS sid, count(*)::int AS n FROM "Classroom" k
      WHERE k."academicYearId" = ${yearId} AND k."schoolId" IN (SELECT id FROM sc) GROUP BY 1
    ),
    att AS (
      SELECT e."schoolId" AS sid, count(*)::int AS total,
             count(*) FILTER (WHERE a.status IN ('ABSENT', 'EXCUSED'))::int AS absent
      FROM "StudentAttendance" a JOIN "Enrollment" e ON e.id = a."enrollmentId"
      WHERE e."academicYearId" = ${yearId} AND e."schoolId" IN (SELECT id FROM sc)
      GROUP BY 1
    ),
    yr AS (
      SELECT e."schoolId" AS sid, avg(rc."generalAverage")::float8 AS m
      FROM "ReportCard" rc JOIN "Enrollment" e ON e.id = rc."enrollmentId"
      WHERE e."academicYearId" = ${prevId} AND rc."generalAverage" IS NOT NULL AND e."schoolId" IN (SELECT id FROM sc)
      GROUP BY e.id, e."schoolId"
    ),
    res AS (
      SELECT sid, count(*)::int AS n, count(*) FILTER (WHERE m >= 10)::int AS passed, coalesce(sum(m), 0)::float8 AS total
      FROM yr GROUP BY 1
    ),
    req AS (
      SELECT r."schoolId" AS sid, count(*)::int AS n FROM "SchoolRequest" r
      WHERE r.status = 'PENDING' AND r."schoolId" IN (SELECT id FROM sc) GROUP BY 1
    )
    SELECT sc.id, sc.name, sc."communeId", sc."departmentId", sc."isActive", sc.status,
           coalesce(enr.total, 0) AS enrollments, coalesce(enr.girls, 0) AS girls, coalesce(enr.disabled, 0) AS disabled,
           coalesce(tea.n, 0) AS teachers, coalesce(cla.n, 0) AS classes,
           coalesce(att.total, 0) AS "attendanceRecords", coalesce(att.absent, 0) AS absences,
           coalesce(res.n, 0) AS "resultStudents", coalesce(res.passed, 0) AS passed, coalesce(res.total, 0) AS "averageSum",
           coalesce(req.n, 0) AS "pendingRequests"
    FROM sc
    LEFT JOIN enr ON enr.sid = sc.id
    LEFT JOIN tea ON tea.sid = sc.id
    LEFT JOIN cla ON cla.sid = sc.id
    LEFT JOIN att ON att.sid = sc.id
    LEFT JOIN res ON res.sid = sc.id
    LEFT JOIN req ON req.sid = sc.id
    ORDER BY sc.name`;
}

type ClassCountsRow = {
  id: string;
  name: string;
  enrollments: number;
  girls: number;
  disabled: number;
  teachers: number;
  attendanceRecords: number;
  absences: number;
  resultStudents: number;
  passed: number;
  averageSum: number;
};

// Raw counts per class of a school. Results are those of last year for the
// students now enrolled in the class, wherever they studied.
async function classCounts(schoolId: string, years: Years): Promise<ClassCountsRow[]> {
  const yearId = years.current?.id ?? "";
  const prevId = years.previous?.id ?? "";
  return db.$queryRaw<ClassCountsRow[]>`
    WITH cl AS (
      SELECT k.id, k.name, l."order" AS lo FROM "Classroom" k JOIN "AcademicLevel" l ON l.id = k."levelId"
      WHERE k."schoolId" = ${schoolId} AND k."academicYearId" = ${yearId}
    ),
    enr AS (
      SELECT e."classroomId" AS cid, count(*)::int AS total,
             count(*) FILTER (WHERE st.gender = 'F')::int AS girls,
             count(*) FILTER (WHERE cardinality(st.disabilities) > 0)::int AS disabled
      FROM "Enrollment" e JOIN "Student" st ON st.id = e."studentId"
      WHERE e.status = 'ACTIVE' AND e."classroomId" IN (SELECT id FROM cl)
      GROUP BY 1
    ),
    tea AS (
      SELECT a."classroomId" AS cid, count(DISTINCT a."teacherId")::int AS n FROM "CourseAssignment" a
      WHERE a."teacherId" IS NOT NULL AND a."classroomId" IN (SELECT id FROM cl) GROUP BY 1
    ),
    att AS (
      SELECT e."classroomId" AS cid, count(*)::int AS total,
             count(*) FILTER (WHERE a.status IN ('ABSENT', 'EXCUSED'))::int AS absent
      FROM "StudentAttendance" a JOIN "Enrollment" e ON e.id = a."enrollmentId"
      WHERE e."classroomId" IN (SELECT id FROM cl)
      GROUP BY 1
    ),
    yr AS (
      SELECT cur."classroomId" AS cid, avg(rc."generalAverage")::float8 AS m
      FROM "Enrollment" cur
      JOIN "Enrollment" prev ON prev."studentId" = cur."studentId" AND prev."academicYearId" = ${prevId}
      JOIN "ReportCard" rc ON rc."enrollmentId" = prev.id
      WHERE cur.status = 'ACTIVE' AND cur."classroomId" IN (SELECT id FROM cl) AND rc."generalAverage" IS NOT NULL
      GROUP BY cur.id, cur."classroomId"
    ),
    res AS (
      SELECT cid, count(*)::int AS n, count(*) FILTER (WHERE m >= 10)::int AS passed, coalesce(sum(m), 0)::float8 AS total
      FROM yr GROUP BY 1
    )
    SELECT cl.id, cl.name,
           coalesce(enr.total, 0) AS enrollments, coalesce(enr.girls, 0) AS girls, coalesce(enr.disabled, 0) AS disabled,
           coalesce(tea.n, 0) AS teachers,
           coalesce(att.total, 0) AS "attendanceRecords", coalesce(att.absent, 0) AS absences,
           coalesce(res.n, 0) AS "resultStudents", coalesce(res.passed, 0) AS passed, coalesce(res.total, 0) AS "averageSum"
    FROM cl
    LEFT JOIN enr ON enr.cid = cl.id
    LEFT JOIN tea ON tea.cid = cl.id
    LEFT JOIN att ON att.cid = cl.id
    LEFT JOIN res ON res.cid = cl.id
    ORDER BY cl.lo, cl.name`;
}

function countsOfSchool(r: SchoolCountsRow): RawCounts {
  return {
    schools: 1,
    activeSchools: r.isActive ? 1 : 0,
    enrollments: r.enrollments,
    girls: r.girls,
    disabled: r.disabled,
    teachers: r.teachers,
    classes: r.classes,
    attendanceRecords: r.attendanceRecords,
    absences: r.absences,
    resultStudents: r.resultStudents,
    passed: r.passed,
    averageSum: r.averageSum,
    pendingRequests: r.pendingRequests,
  };
}

function groupSchools(rows: SchoolCountsRow[], key: (r: SchoolCountsRow) => string, names: { id: string; name: string }[]): ChildRow[] {
  const byKey = new Map<string, RawCounts[]>();
  for (const r of rows) byKey.set(key(r), [...(byKey.get(key(r)) ?? []), countsOfSchool(r)]);
  return names.map((n) => ({ id: n.id, name: n.name, indicators: computeIndicators(sumCounts(byKey.get(n.id) ?? [])) }));
}

async function computeStatistics(scope: StatScope, yearId: string | null): Promise<ScopeStatistics> {
  const years = await yearsFor(yearId);
  const schools = await schoolCounts(scope, years);
  const total = computeIndicators(sumCounts(schools.map(countsOfSchool)));
  const base = { scope, yearLabel: years.current?.label ?? null, previousYearLabel: years.previous?.label ?? null, total, computedAt: new Date().toISOString() };

  switch (scope.level) {
    case "NATIONAL": {
      const departments = await db.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
      return { ...base, childLevel: "DEPARTMENT", children: groupSchools(schools, (r) => r.departmentId, departments) };
    }
    case "DEPARTMENT": {
      const communes = await db.commune.findMany({ where: { departmentId: scope.id }, select: { id: true, name: true }, orderBy: { name: "asc" } });
      return { ...base, childLevel: "COMMUNE", children: groupSchools(schools, (r) => r.communeId, communes) };
    }
    case "COMMUNE":
      return {
        ...base,
        childLevel: "SCHOOL",
        children: schools.map((r) => ({ id: r.id, name: r.name, status: r.status, indicators: computeIndicators(countsOfSchool(r)) })),
      };
    case "SCHOOL": {
      const classes = await classCounts(scope.id, years);
      return {
        ...base,
        childLevel: "CLASS",
        children: classes.map((c) => ({
          id: c.id,
          name: c.name,
          indicators: computeIndicators({ ...emptyCounts(), ...c, classes: 1 }),
        })),
      };
    }
  }
}

// Cached per territorial scope and shared by every user of that scope. The
// key is the scope, never the user. Invalidated through tags.stats by every
// action that changes an input (schools, requests, enrollments, attendance).
const cachedStatistics = cached((_key: string, scope: StatScope, yearId: string | null) => computeStatistics(scope, yearId), ["statistics", "v3"], {
  tags: [tags.stats],
  revalidate: 600,
});

// The caller must have checked that the scope is inside the user's territory
// (see territory/scope.ts).
// yearId: a year from the year selector; omitted, the active year.
export function getStatistics(scope: StatScope, yearId: string | null = null) {
  return cachedStatistics(statScopeKey(scope), scope, yearId);
}

export const CHILD_LABELS: Record<ChildLevel, { singular: string; plural: string }> = {
  DEPARTMENT: { singular: "Département", plural: "Départements" },
  COMMUNE: { singular: "Commune", plural: "Communes" },
  SCHOOL: { singular: "Établissement", plural: "Établissements" },
  CLASS: { singular: "Classe", plural: "Classes" },
};
