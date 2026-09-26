-- CreateEnum
CREATE TYPE "Periodicity" AS ENUM ('TRIMESTER', 'SEMESTER');

-- CreateEnum
CREATE TYPE "EducationChain" AS ENUM ('PRIMARY', 'SECONDARY');

-- DropIndex
DROP INDEX "SchoolPeriod_academicYearId_order_key";

-- AlterTable: new sheets follow the national formula, two interrogations
-- écrites and two devoirs surveillés. Existing sheets keep their formula.
ALTER TABLE "GradeSheet" ALTER COLUMN "formula" SET DEFAULT 'OFFICIAL_2024',
ALTER COLUMN "devoirCount" SET DEFAULT 2,
ALTER COLUMN "compositionCount" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "allowsComposition" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "periodicity" "Periodicity" NOT NULL DEFAULT 'TRIMESTER';

-- AlterTable
ALTER TABLE "SchoolPeriod" ADD COLUMN     "periodicity" "Periodicity" NOT NULL DEFAULT 'TRIMESTER';

-- AlterTable: null keeps existing departmental accounts on both chains.
ALTER TABLE "User" ADD COLUMN     "chain" "EducationChain";

-- Backfill 1: periods the ministry already named as semesters.
UPDATE "SchoolPeriod" SET "periodicity" = 'SEMESTER' WHERE "name" ILIKE 'semestre%';

-- CreateIndex
CREATE UNIQUE INDEX "SchoolPeriod_academicYearId_periodicity_order_key" ON "SchoolPeriod"("academicYearId", "periodicity", "order");

-- Backfill 2: every year with terms gets its two semesters, derived from
-- the terms (first semester up to the middle of the second term, second
-- semester to the end of the last one), closed when all its terms are.
-- The ministry adjusts the dates from the calendar page.
WITH t AS (
  SELECT "academicYearId" AS y,
         min("startDate") FILTER (WHERE "order" = 1) AS s1,
         min("startDate") FILTER (WHERE "order" = 2) AS s2,
         min("endDate") FILTER (WHERE "order" = 2) AS e2,
         max("endDate") AS last_end,
         bool_and("isClosed") AS closed,
         count(*) AS n
  FROM "SchoolPeriod" WHERE "periodicity" = 'TRIMESTER' GROUP BY 1
), m AS (
  SELECT y, s1, last_end, closed, date_trunc('day', s2 + (e2 - s2) / 2) AS mid FROM t
  WHERE n >= 2 AND s1 IS NOT NULL AND s2 IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "SchoolPeriod" p WHERE p."academicYearId" = t.y AND p."periodicity" = 'SEMESTER')
)
INSERT INTO "SchoolPeriod" ("id", "academicYearId", "name", "periodicity", "order", "startDate", "endDate", "isClosed")
SELECT gen_random_uuid()::text, y, 'Semestre 1', 'SEMESTER'::"Periodicity", 1, s1, mid, closed FROM m
UNION ALL
SELECT gen_random_uuid()::text, y, 'Semestre 2', 'SEMESTER'::"Periodicity", 2, mid + interval '1 day', last_end, closed FROM m;

-- Backfill 3: public secondary schools move to semesters, except those that
-- already hold marks or report cards on the terms of the active year: they
-- stay on terms so nothing entered disappears from view, and the ministry
-- switches them when it decides. Past years keep reading their own periods.
UPDATE "School" s SET "periodicity" = 'SEMESTER'
WHERE s."sector" = 'PUBLIC' AND s."cycle" IN ('SECONDARY', 'TECHNICAL')
  AND NOT EXISTS (
    SELECT 1 FROM "GradeSheet" g
    JOIN "SchoolPeriod" p ON p.id = g."periodId"
    JOIN "AcademicYear" y ON y.id = p."academicYearId"
    JOIN "CourseAssignment" a ON a.id = g."assignmentId"
    JOIN "Classroom" k ON k.id = a."classroomId"
    WHERE k."schoolId" = s.id AND y."isActive" AND p."periodicity" = 'TRIMESTER'
  )
  AND NOT EXISTS (
    SELECT 1 FROM "ReportCard" rc
    JOIN "SchoolPeriod" p ON p.id = rc."periodId"
    JOIN "AcademicYear" y ON y.id = p."academicYearId"
    JOIN "Enrollment" e ON e.id = rc."enrollmentId"
    WHERE e."schoolId" = s.id AND y."isActive" AND p."periodicity" = 'TRIMESTER'
  );

-- Backfill 4: a school whose sheets already use compositions keeps the
-- option, so its teachers can go on entering them.
UPDATE "School" s SET "allowsComposition" = true
WHERE EXISTS (
  SELECT 1 FROM "GradeSheet" g
  JOIN "CourseAssignment" a ON a.id = g."assignmentId"
  JOIN "Classroom" k ON k.id = a."classroomId"
  WHERE k."schoolId" = s.id AND (g."formula" <> 'OFFICIAL_2024' OR g."compositionCount" > 0)
);
