import type { Metadata } from "next";

import { PageHeader } from "@/components/kit/page-header";
import { EmptyState } from "@/components/kit/states";
import { classroomOptions } from "@/features/classes/queries";
import { StudentForm } from "@/features/students/components/student-form";
import { guardianOptions } from "@/features/students/queries";
import { requirePermission } from "@/lib/auth/authorize";

export const metadata: Metadata = { title: "Inscrire un élève" };

export default async function NewStudentPage() {
  const user = await requirePermission("student:create");
  const [classes, guardians] = await Promise.all([classroomOptions(user), guardianOptions(user)]);
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Élèves", href: "/espace/eleves" }, { label: "Inscription" }]} title="Inscrire un élève" info="Inscription pour l'année active. Le matricule est attribué à l'enregistrement." />
      {classes.length ? (
        <StudentForm classes={classes} guardians={guardians} cancelHref="/espace/eleves" />
      ) : (
        <EmptyState title="Aucune classe ouverte" description="Créez d'abord une classe pour l'année active." />
      )}
    </>
  );
}
