-- The national subject average (MESTFP order n° 029 of 2024). Added alone:
-- PostgreSQL cannot use a new enum value in the transaction that adds it.
ALTER TYPE "GradeFormula" ADD VALUE 'OFFICIAL_2024' BEFORE 'WEIGHTED_STANDARD';
