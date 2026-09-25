import type { Metadata } from "next";
import Link from "next/link";

import { DataTable, type Column } from "@/components/kit/data-table";
import { PageHeader } from "@/components/kit/page-header";
import { Badge } from "@/components/ui/badge";
import { UrlSelect } from "@/components/kit/url-select";
import { CreateTeacherDialog } from "@/features/teachers/components/teacher-forms";
import { listTeachers } from "@/features/teachers/queries";
import { can, requirePermission } from "@/lib/auth/authorize";
import { listParams, param } from "@/lib/list";

export const metadata: Metadata = { title: "Enseignants" };

type Row = Awaited<ReturnType<typeof listTeachers>>["rows"][number];

export default async function TeachersPage(props: PageProps<"/espace/enseignants">) {
  const user = await requirePermission("teacher:view");
  const sp = await props.searchParams;
  const { q, page, pageSize, skip, take } = listParams(sp);
  const statut = param(sp, "statut");
  const active = statut === "tous" ? null : statut !== "inactifs";
  const { rows, total } = await listTeachers(user, { q, active, skip, take });
  const multiSchool = user.scope.level !== "SCHOOL";

  const columns: Column<Row>[] = [
    {
      header: "Enseignant",
      primary: true,
      cell: (r) => (
        <div>
          <Link href={`/espace/enseignants/${r.id}`} className="font-semibold text-primary hover:underline">
            {r.lastName} {r.firstName}
          </Link>
          <span className="block font-mono text-xs text-muted">{r.matricule}</span>
        </div>
      ),
    },
    ...(multiSchool ? [{ header: "Établissement", cell: (r: Row) => r.school.name, hideBelow: "lg" as const }] : []),
    { header: "Spécialité", cell: (r) => r.specialty ?? "–", hideBelow: "sm" },
    {
      header: "Classes",
      cell: (r) => {
        const names = [...new Set(r.assignments.map((a) => a.classroom.name))];
        return names.length ? names.join(", ") : <span className="text-muted">Aucune</span>;
      },
      hideBelow: "md",
    },
    { header: "H/sem.", cell: (r) => r.assignments.reduce((a, x) => a + x.weeklyHours, 0), className: "text-right", hideBelow: "lg" },
    { header: "Prof. principal", cell: (r) => (r.mainClasses.length ? r.mainClasses.map((c) => c.name).join(", ") : "–"), hideBelow: "lg" },
    { header: "Téléphone", cell: (r) => r.phone ?? "–", hideBelow: "md" },
    {
      header: "Statut",
      cell: (r) => (
        <span className="flex flex-wrap gap-1">
          <Badge tone={r.isActive ? "success" : "neutral"}>{r.isActive ? "En activité" : "Inactif"}</Badge>
          {r.userId && <Badge tone="info">Compte</Badge>}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Enseignants"
        description="Équipe pédagogique de l'année active."
        actions={can(user, "teacher:create") && user.scope.schoolId && <CreateTeacherDialog />}
      />
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        total={total}
        page={page}
        pageSize={pageSize}
        searchParams={sp}
        basePath="/espace/enseignants"
        searchPlaceholder="Nom, matricule ou spécialité"
        toolbar={
          <UrlSelect
            param="statut"
            label="Statut"
            hideLabel
            value={statut ?? "actifs"}
            options={[
              { value: "actifs", label: "En activité" },
              { value: "inactifs", label: "Inactifs" },
              { value: "tous", label: "Tous les statuts" },
            ]}
            className="sm:w-48"
          />
        }
        caption="Liste des enseignants"
        emptyTitle="Aucun enseignant"
        emptyDescription={q ? "Vérifiez l'orthographe ou cherchez par matricule." : undefined}
      />
    </>
  );
}
