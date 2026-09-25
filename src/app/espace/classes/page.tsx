import type { Metadata } from "next";
import Link from "next/link";

import { DataTable, type Column } from "@/components/kit/data-table";
import { PageHeader } from "@/components/kit/page-header";
import { Badge } from "@/components/ui/badge";
import { getActiveYear } from "@/features/classes/academic";
import { CreateClassDialog } from "@/features/classes/components/class-forms";
import { classFormOptions, listClassrooms } from "@/features/classes/queries";
import { can, requirePermission } from "@/lib/auth/authorize";
import { listParams } from "@/lib/list";

export const metadata: Metadata = { title: "Classes" };

type Row = Awaited<ReturnType<typeof listClassrooms>>["rows"][number];

export default async function ClassesPage(props: PageProps<"/espace/classes">) {
  const user = await requirePermission("class:view");
  const sp = await props.searchParams;
  const { q, page, pageSize, skip, take } = listParams(sp);
  const [year, { rows, total }] = await Promise.all([getActiveYear(), listClassrooms(user, { q, skip, take })]);
  const canCreate = can(user, "class:create") && !!user.scope.schoolId;
  const options = canCreate ? await classFormOptions(user) : null;
  const multiSchool = user.scope.level !== "SCHOOL";

  const columns: Column<Row>[] = [
    {
      header: "Classe",
      primary: true,
      cell: (r) => (
        <Link href={`/espace/classes/${r.id}`} className="font-semibold text-primary hover:underline">
          {r.name}
        </Link>
      ),
    },
    ...(multiSchool ? [{ header: "Établissement", cell: (r: Row) => r.school.name, hideBelow: "md" as const }] : []),
    { header: "Niveau", cell: (r) => r.level.name, hideBelow: "sm" },
    {
      header: "Effectif",
      cell: (r) => (
        <span className="tabular-nums">
          {r._count.enrollments} / {r.capacity}
          {r._count.enrollments >= r.capacity && (
            <Badge tone="warning" className="ml-2">
              Complète
            </Badge>
          )}
        </span>
      ),
    },
    {
      header: "Professeur principal",
      cell: (r) => (r.mainTeacher ? `${r.mainTeacher.firstName} ${r.mainTeacher.lastName}` : <span className="text-muted">Non désigné</span>),
      hideBelow: "md",
    },
    { header: "Matières", cell: (r) => r._count.assignments, hideBelow: "lg" },
  ];

  return (
    <>
      <PageHeader
        title="Classes"
        description={year ? `Année scolaire ${year.label}` : undefined}
        actions={options && <CreateClassDialog options={options} />}
      />
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        total={total}
        page={page}
        pageSize={pageSize}
        searchParams={sp}
        basePath="/espace/classes"
        searchPlaceholder="Nom de la classe"
        caption="Liste des classes"
        emptyTitle={q ? "Aucune classe ne correspond à la recherche" : "Aucune classe pour cette année"}
        emptyDescription={q ? "Essayez un autre nom." : canCreate ? "Créez la première avec « Nouvelle classe »." : undefined}
      />
    </>
  );
}
