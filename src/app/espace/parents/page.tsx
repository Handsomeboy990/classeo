import type { Metadata } from "next";
import Link from "next/link";

import { DataTable, type Column } from "@/components/kit/data-table";
import { PageHeader } from "@/components/kit/page-header";
import { Badge } from "@/components/ui/badge";
import { CreateGuardianDialog } from "@/features/parents/components/parent-forms";
import { listGuardians, studentChoices } from "@/features/parents/queries";
import { CHANNEL_LABELS } from "@/features/students/labels";
import { can, requirePermission } from "@/lib/auth/authorize";
import { listParams } from "@/lib/list";

export const metadata: Metadata = { title: "Parents" };

type Row = Awaited<ReturnType<typeof listGuardians>>["rows"][number];

export default async function ParentsPage(props: PageProps<"/espace/parents">) {
  const user = await requirePermission("parent:view");
  const sp = await props.searchParams;
  const { q, page, pageSize, skip, take } = listParams(sp);
  const canCreate = can(user, "parent:create");
  const [{ rows, total }, students] = await Promise.all([listGuardians(user, { q, skip, take }), canCreate ? studentChoices(user) : Promise.resolve([])]);

  const columns: Column<Row>[] = [
    {
      header: "Parent",
      primary: true,
      cell: (r) => (
        <Link href={`/espace/parents/${r.id}`} className="font-semibold text-primary hover:underline">
          {r.lastName} {r.firstName}
        </Link>
      ),
    },
    { header: "Téléphone", cell: (r) => <span className="font-mono text-xs">{r.phone}</span> },
    {
      header: "Enfants",
      cell: (r) => (
        <ul>
          {r.students.map((s) => (
            <li key={s.student.id}>
              <Link href={`/espace/eleves/${s.student.id}`} className="hover:underline">
                {s.student.firstName} {s.student.lastName}
              </Link>{" "}
              <span className="text-xs text-muted">({s.relationship})</span>
            </li>
          ))}
        </ul>
      ),
      hideBelow: "sm",
    },
    {
      header: "Contact",
      cell: (r) => (
        <span className="flex flex-wrap gap-1">
          <Badge>{CHANNEL_LABELS[r.preferredChannel]}</Badge>
          {r.prefersAudio && <Badge tone="info">Audio</Badge>}
          {r.userId && <Badge tone="success">Compte</Badge>}
        </span>
      ),
      hideBelow: "md",
    },
  ];

  return (
    <>
      <PageHeader title="Parents et tuteurs" actions={canCreate && <CreateGuardianDialog students={students} />} />
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        rowHref={(r) => `/espace/parents/${r.id}`}
        total={total}
        page={page}
        pageSize={pageSize}
        searchParams={sp}
        basePath="/espace/parents"
        searchPlaceholder="Parent, téléphone ou élève"
        caption="Liste des parents et tuteurs"
        emptyTitle={q ? "Aucun parent ne correspond à la recherche" : "Aucun parent"}
        emptyDescription={q ? "Cherchez par nom, par téléphone ou par le nom d'un enfant." : undefined}
      />
    </>
  );
}
