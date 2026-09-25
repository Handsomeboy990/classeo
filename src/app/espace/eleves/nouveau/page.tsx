import type { Metadata } from "next";
import Link from "next/link";

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
      <nav aria-label="Fil d'Ariane" className="mb-2 text-sm text-muted">
        <Link href="/espace/eleves" className="hover:underline">
          Élèves
        </Link>{" "}
        / Inscription
      </nav>
      <PageHeader title="Inscrire un élève" description="L'élève reçoit un matricule et il est inscrit dans une classe de l'année active, avec son parent principal." />
      {classes.length ? (
        <StudentForm classes={classes} guardians={guardians} cancelHref="/espace/eleves" />
      ) : (
        <EmptyState title="Aucune classe ouverte" description="Créez d'abord une classe pour l'année active." />
      )}
    </>
  );
}
