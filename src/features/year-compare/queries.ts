import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { cached, tags } from "@/lib/cache";
import { db } from "@/lib/db";
import { isYearClosed } from "@/lib/guards";

import { yearStatus, type YearStatus } from "../calendar/rules";
import { statScopeKey, type StatScope } from "../territory/scope";
import { compareYears, type Comparison, type CountRow } from "./compute";

export type CompareChildLevel = "DEPARTMENT" | "COMMUNE" | "SCHOOL" | "LEVEL";

export type YearComparison = Comparison & {
  scope: StatScope;
  years: { id: string; label: string; status: YearStatus }[];
  childLevel: CompareChildLevel;
  computedAt: string;
};

const MAX_YEARS = 6;

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

function childColumn(level: CompareChildLevel): Prisma.Sql {
  switch (level) {
    case "DEPARTMENT":
      return Prisma.sql`sc."departmentId"`;
    case "COMMUNE":
      return Prisma.sql`sc."communeId"`;
    case "SCHOOL":
      return Prisma.sql`sc.id`;
    case "LEVEL":
      return Prisma.sql`k."levelId"`;
  }
}

type SqlRow = { yearId: string; childId: string; enrollments: number; girls: number; attendanceRecords: number; absences: number; resultStudents: number; passed: number; averageSum: number };

// Raw counts per (year, child territory) for the years given, in one round
// trip. Results of a year come from that year's published report cards: a
// student's yearly average is the mean of their term averages.
async function countRows(scope: StatScope, childLevel: CompareChildLevel, yearIds: string[]): Promise<CountRow[]> {
  if (!yearIds.length) return [];
  const child = childColumn(childLevel);
  const rows = await db.$queryRaw<SqlRow[]>`
    WITH sc AS (
      SELECT s.id, s."communeId", c."departmentId"
      FROM "School" s JOIN "Commune" c ON c.id = s."communeId"
      WHERE ${schoolFilter(scope)}
    ),
    base AS (
      SELECT e.id, e."academicYearId" AS y, ${child} AS cid, st.gender
      FROM "Enrollment" e
      JOIN sc ON sc.id = e."schoolId"
      JOIN "Classroom" k ON k.id = e."classroomId"
      JOIN "Student" st ON st.id = e."studentId"
      WHERE e."academicYearId" IN (${Prisma.join(yearIds)}) AND e.status = 'ACTIVE'
    ),
    enr AS (
      SELECT y, cid, count(*)::int AS n, count(*) FILTER (WHERE gender = 'F')::int AS girls FROM base GROUP BY 1, 2
    ),
    att AS (
      SELECT b.y, b.cid, count(*)::int AS n, count(*) FILTER (WHERE a.status IN ('ABSENT', 'EXCUSED'))::int AS absent
      FROM "StudentAttendance" a JOIN base b ON b.id = a."enrollmentId" GROUP BY 1, 2
    ),
    avgs AS (
      SELECT b.y, b.cid, round((sum(rc."generalAverage" * CASE WHEN p."periodicity" = 'SEMESTER' AND p."order" >= 2 THEN 2 ELSE 1 END) / sum(CASE WHEN p."periodicity" = 'SEMESTER' AND p."order" >= 2 THEN 2 ELSE 1 END))::numeric, 2)::float8 AS m
      FROM "ReportCard" rc JOIN base b ON b.id = rc."enrollmentId" JOIN "SchoolPeriod" p ON p.id = rc."periodId"
      WHERE rc."generalAverage" IS NOT NULL GROUP BY b.id, b.y, b.cid
    ),
    res AS (
      SELECT y, cid, count(*)::int AS n, count(*) FILTER (WHERE m >= 10)::int AS passed, coalesce(sum(m), 0)::float8 AS total FROM avgs GROUP BY 1, 2
    )
    SELECT enr.y AS "yearId", enr.cid AS "childId", enr.n AS enrollments, enr.girls,
           coalesce(att.n, 0) AS "attendanceRecords", coalesce(att.absent, 0) AS absences,
           coalesce(res.n, 0) AS "resultStudents", coalesce(res.passed, 0) AS passed, coalesce(res.total, 0) AS "averageSum"
    FROM enr
    LEFT JOIN att ON att.y = enr.y AND att.cid = enr.cid
    LEFT JOIN res ON res.y = enr.y AND res.cid = enr.cid`;
  return rows;
}

async function childrenOf(scope: StatScope): Promise<{ level: CompareChildLevel; list: { id: string; name: string }[] }> {
  switch (scope.level) {
    case "NATIONAL":
      return { level: "DEPARTMENT", list: await db.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) };
    case "DEPARTMENT":
      return { level: "COMMUNE", list: await db.commune.findMany({ where: { departmentId: scope.id }, select: { id: true, name: true }, orderBy: { name: "asc" } }) };
    case "COMMUNE":
      return { level: "SCHOOL", list: await db.school.findMany({ where: { communeId: scope.id }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }) };
    case "SCHOOL": {
      const school = await db.school.findUnique({ where: { id: scope.id }, select: { cycle: true } });
      const levels = await db.academicLevel.findMany({ where: { cycle: school?.cycle ?? "PRIMARY" }, select: { id: true, name: true }, orderBy: { order: "asc" } });
      return { level: "LEVEL", list: levels };
    }
  }
}

async function computeComparison(scope: StatScope): Promise<YearComparison> {
  const now = new Date();
  // The most recent years that have started, oldest first.
  const years = (
    await db.academicYear.findMany({
      where: { startDate: { lte: now } },
      orderBy: { startDate: "desc" },
      take: MAX_YEARS,
      select: { id: true, label: true, isActive: true, startDate: true, endDate: true, closedAt: true },
    })
  ).reverse();
  const { level, list } = await childrenOf(scope);
  const rows = await countRows(scope, level, years.map((y) => y.id));
  const result = compareYears(rows, years.map((y) => y.id), list);
  return {
    ...result,
    scope,
    years: years.map((y) => ({ id: y.id, label: y.label, status: yearStatus(y, isYearClosed(y, now), now) })),
    childLevel: level,
    computedAt: now.toISOString(),
  };
}

// Shared by every user of the scope, invalidated with the statistics.
const cachedComparison = cached((_key: string, scope: StatScope) => computeComparison(scope), ["year-compare", "v1"], { tags: [tags.stats], revalidate: 600 });

// The caller has checked that the scope is inside the user's territory.
export function getYearComparison(scope: StatScope) {
  return cachedComparison(statScopeKey(scope), scope);
}

export const COMPARE_CHILD_LABELS: Record<CompareChildLevel, string> = {
  DEPARTMENT: "Départements",
  COMMUNE: "Communes",
  SCHOOL: "Établissements",
  LEVEL: "Niveaux",
};

export const COMPARE_CHILD_SINGULAR: Record<CompareChildLevel, string> = {
  DEPARTMENT: "département",
  COMMUNE: "commune",
  SCHOOL: "établissement",
  LEVEL: "niveau",
};
