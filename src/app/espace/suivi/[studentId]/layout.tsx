import { Avatar } from "@/components/ui/avatar";
import { BackToChildren } from "@/features/family/components/sections";
import { SectionTabs, type SectionKey } from "@/features/family/components/section-tabs";
import { requireStudentFile } from "@/features/family/queries";
import { allowedSections } from "@/features/family/sections";

// Header and section navigation of a student file. Every page below calls
// requireStudentFile() again: a layout is not a security boundary.
export default async function StudentFileLayout({ children, params }: LayoutProps<"/espace/suivi/[studentId]">) {
  const { studentId } = await params;
  const { user, enrollment } = await requireStudentFile(studentId);
  const name = `${enrollment.student.firstName} ${enrollment.student.lastName}`;
  const isSelf = user.studentId === enrollment.student.id;

  const labels: Record<SectionKey, string> = {
    bulletins: "Bulletins",
    notes: "Notes du trimestre",
    presences: "Présences",
    "emploi-du-temps": "Emploi du temps",
    frais: "Frais",
  };
  // Only the sections the account has the right to read.
  const sections = allowedSections(user.permissions).map((key) => ({ key, label: labels[key] }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4" data-print-hide>
        {!isSelf && <BackToChildren />}
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={name} className="size-16 text-xl" />
          <div className="min-w-0 break-words hyphens-auto">
            <h1 className="text-2xl font-bold sm:text-3xl">{isSelf ? "Ma scolarité" : name}</h1>
            <p className="text-muted">
              {enrollment.classroom.name} · {enrollment.school.name} · Année {enrollment.academicYear.label}
            </p>
          </div>
        </div>
        <SectionTabs base={`/espace/suivi/${enrollment.student.id}`} sections={sections} />
      </div>
      {children}
    </div>
  );
}
