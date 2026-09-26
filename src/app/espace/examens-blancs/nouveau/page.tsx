import type { Metadata } from "next";
import { forbidden } from "next/navigation";

import { EmptyState } from "@/components/kit/states";
import { PageHeader } from "@/components/kit/page-header";
import { getActiveYear } from "@/features/classes/academic";
import { CreateExamForm } from "@/features/mock-exams/components/create-exam-form";
import { candidateSchools, examLevels, subjectsByLevel } from "@/features/mock-exams/queries";
import { ORGANIZER_LABELS, organizerLevelOf } from "@/features/mock-exams/rules";
import { requirePermission } from "@/lib/auth/authorize";
import { communeWhere, departmentWhere, isTeacherRole } from "@/lib/auth/scope";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Nouvel examen blanc" };

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function NewMockExamPage() {
  const user = await requirePermission("mock_exam:create");
  const level = organizerLevelOf(user.scope.level);
  if (!level || isTeacherRole(user)) forbidden();
  const year = await getActiveYear();
  if (!year) return <EmptyState title="Aucune année scolaire active" description="Un examen blanc se tient pendant l'année scolaire active." />;

  const levels = await examLevels();
  const levelIds = levels.map((l) => l.id);
  const [subjects, schools, communes, departments, home] = await Promise.all([
    subjectsByLevel(year.id, levelIds),
    candidateSchools(user, year.id, levelIds),
    level === "DEPARTMENT" || level === "NATIONAL" ? db.commune.findMany({ where: communeWhere(user), select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
    level === "NATIONAL" ? db.department.findMany({ where: departmentWhere(user), select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
    level === "SCHOOL" && user.scope.schoolId
      ? db.school.findUnique({ where: { id: user.scope.schoolId }, select: { name: true, communeId: true, commune: { select: { name: true, department: { select: { name: true } } } } } })
      : null,
  ]);

  const organizer =
    level === "SCHOOL" && home
      ? { level, label: home.name, home: { communeId: home.communeId, communeName: home.commune.name, departmentName: home.commune.department.name } }
      : { level, label: `${ORGANIZER_LABELS[level]}, ${user.scope.label}` };

  return (
    <>
      <PageHeader
        title={level === "SCHOOL" ? "Organiser un examen blanc" : "Décider un examen blanc"}
        info={
          level === "SCHOOL"
            ? "Choisissez la classe d'examen, les dates, les matières et les établissements partenaires. La hiérarchie valide l'examen avant qu'il se tienne."
            : "Choisissez la classe d'examen, les dates, les matières et les établissements concernés : leur participation est obligatoire."
        }
      />
      <CreateExamForm
        organizer={organizer}
        levels={levels}
        subjects={subjects}
        schools={schools}
        communes={communes}
        departments={departments}
        year={{ label: year.label, start: iso(year.startDate), end: iso(year.endDate) }}
      />
    </>
  );
}
