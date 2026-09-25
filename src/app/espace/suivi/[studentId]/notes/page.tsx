import { NotebookPen } from "lucide-react";
import type { Metadata } from "next";

import { AverageLevel } from "@/components/kit/level";
import { EmptyState } from "@/components/kit/states";
import { SpokenSummary } from "@/features/family/components/blocks";
import { TermGradesList } from "@/features/family/components/sections";
import { beninToday } from "@/features/family/logic";
import { requireStudentFile, termGrades } from "@/features/family/queries";
import { mention } from "@/lib/domain/grades";
import { formatAverage } from "@/lib/utils";

export const metadata: Metadata = { title: "Notes du trimestre" };

export default async function TermGradesPage({ params }: PageProps<"/espace/suivi/[studentId]/notes">) {
  const { studentId } = await params;
  const { enrollment } = await requireStudentFile(studentId);
  const term = await termGrades(enrollment, beninToday());
  const first = enrollment.student.firstName;
  const graded = term.subjects.filter((s) => s.average !== null);

  if (!term.period || graded.length === 0) {
    return (
      <EmptyState
        className="rounded-card border border-border bg-surface"
        icon={<NotebookPen className="size-7" />}
        title="Pas encore de note ce trimestre"
        description="Les notes apparaissent ici dès qu'un enseignant les saisit. La moyenne se met à jour toute seule."
      />
    );
  }

  const best = [...graded].sort((a, b) => (b.average ?? 0) - (a.average ?? 0))[0]!;
  const weakest = [...graded].sort((a, b) => (a.average ?? 0) - (b.average ?? 0))[0]!;
  const m = mention(term.average);
  const text = [
    `Notes de ${first}, ${term.period.name.toLowerCase()}.`,
    `Moyenne provisoire : ${formatAverage(term.average)} sur 20${m ? `, ${m.label}` : ""}.`,
    `${graded.length} matières notées sur ${term.subjects.length}.`,
    graded.length > 1 ? `Meilleure matière : ${best.subject}. À travailler : ${weakest.subject}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-5">
      <SpokenSummary text={text} label="Écouter les notes" />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface p-4 [&_.rounded-full]:flex-wrap">
        <div>
          <h2 className="text-lg font-bold">{term.period.name} · moyenne provisoire</h2>
          <p className="text-sm text-muted">Calculée avec les notes déjà saisies, coefficients compris.</p>
        </div>
        <AverageLevel average={term.average} size="lg" />
      </div>
      <TermGradesList term={term} />
    </div>
  );
}
