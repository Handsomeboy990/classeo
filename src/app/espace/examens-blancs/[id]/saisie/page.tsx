import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/kit/page-header";
import { UrlSelect } from "@/components/kit/url-select";
import { Alert } from "@/components/ui/alert";
import { ResultsGrid } from "@/features/mock-exams/components/results-grid";
import { entryRows, getExam, writableClassrooms } from "@/features/mock-exams/queries";
import { resultsOpen } from "@/features/mock-exams/rules";
import { requirePermission } from "@/lib/auth/authorize";
import { param } from "@/lib/list";

export const metadata: Metadata = { title: "Saisie des notes d'examen blanc" };

// Entry of one class: the classes offered are those the account may write
// (scope and, for a teacher, own subjects), so an identifier typed in the
// address bar reaches nothing else.
export default async function MockExamEntryPage({ params, searchParams }: PageProps<"/espace/examens-blancs/[id]/saisie">) {
  const user = await requirePermission("mock_exam:update");
  const { id } = await params;
  const exam = await getExam(user, id);
  if (!exam) notFound();
  const rooms = await writableClassrooms(user, exam);
  if (!rooms.length) notFound();
  const wanted = param(await searchParams, "classe");
  const room = rooms.find((r) => r.id === wanted) ?? rooms[0]!;
  const rows = await entryRows(exam.id, room.id);
  const open = resultsOpen(exam);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Examens blancs", href: "/espace/examens-blancs" }, { label: exam.title, href: `/espace/examens-blancs/${exam.id}` }, { label: room.name }]}
        title={`Saisie des notes · ${room.name}`}
        description={`${exam.title}, ${exam.level?.name ?? ""}. Vous saisissez : ${exam.subjectList
          .filter((s) => room.subjects.includes(s.code))
          .map((s) => s.name)
          .join(", ")}.`}
        actions={rooms.length > 1 ? <UrlSelect param="classe" label="Classe" value={room.id} options={rooms.map((r) => ({ value: r.id, label: r.name }))} /> : null}
      />
      {!open && (
        <Alert tone="info" className="mb-4">
          {exam.status === "CLOSED" ? "L'examen est clôturé : les notes sont définitives." : "La saisie ouvre au premier jour des épreuves d'un examen validé."}
        </Alert>
      )}
      <ResultsGrid
        examId={exam.id}
        classroomId={room.id}
        subjects={exam.subjectList}
        editable={open ? room.subjects : []}
        rows={rows}
        readOnlyReason={exam.status === "CLOSED" ? "Examen clôturé" : "Saisie fermée"}
      />
    </>
  );
}
