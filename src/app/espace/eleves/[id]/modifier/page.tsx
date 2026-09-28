import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/kit/page-header";
import { EmptyState } from "@/components/kit/states";
import { classroomOptions } from "@/features/classes/queries";
import { StudentForm } from "@/features/students/components/student-form";
import { canSeeSpecialNeeds } from "@/features/students/needs";
import { getStudentForEdit } from "@/features/students/queries";
import { requirePermission } from "@/lib/auth/authorize";
import { dateToIso } from "@/lib/domain/attendance";
import { fileUrl } from "@/lib/files";

export const metadata: Metadata = { title: "Modifier un élève" };

export default async function EditStudentPage(props: PageProps<"/espace/eleves/[id]/modifier">) {
  const user = await requirePermission("student:update");
  const { id } = await props.params;
  const [student, classes] = await Promise.all([getStudentForEdit(user, id), classroomOptions(user)]);
  if (!student) notFound();
  const enrollment = student.enrollments[0];
  const name = `${student.firstName} ${student.lastName}`;
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Élèves", href: "/espace/eleves" }, { label: name, href: `/espace/eleves/${student.id}` }, { label: "Modifier" }]} title={`Modifier : ${name}`} description={`Matricule ${student.matricule}`} readable={false} />
      {enrollment ? (
        <StudentForm
          classes={classes}
          cancelHref={`/espace/eleves/${student.id}`}
          values={{
            id: student.id,
            lastName: student.lastName,
            firstName: student.firstName,
            gender: student.gender,
            birthDate: dateToIso(student.birthDate),
            birthPlace: student.birthPlace,
            // Shown and editable only by those who may read them (D8).
            disabilities: canSeeSpecialNeeds(user, enrollment) ? student.disabilities : null,
            classroomId: enrollment.classroomId,
            isRepeating: enrollment.isRepeating,
            photoUrl: fileUrl(student.photoFileId),
          }}
        />
      ) : (
        <EmptyState title="Pas d'inscription cette année" description="Cet élève n'est pas inscrit dans votre établissement pour l'année active." />
      )}
    </>
  );
}
