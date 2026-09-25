import { Download, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DataTable, type Column } from "@/components/kit/data-table";
import { PageHeader } from "@/components/kit/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { getActiveYear } from "@/features/classes/academic";
import { UrlSelect } from "@/features/classes/components/url-select";
import { classroomOptions } from "@/features/classes/queries";
import { DISABILITY_LABELS, ENROLLMENT_STATUS_LABELS, GENDER_LABELS, shortDate } from "@/features/students/labels";
import { listStudents } from "@/features/students/queries";
import { can, requirePermission } from "@/lib/auth/authorize";
import { listParams, param } from "@/lib/list";

export const metadata: Metadata = { title: "Élèves" };

type Row = Awaited<ReturnType<typeof listStudents>>["rows"][number];

const STATUSES = ["ACTIVE", "WITHDRAWN", "TRANSFERRED", "ALL"] as const;

export default async function StudentsPage(props: PageProps<"/espace/eleves">) {
  const user = await requirePermission("student:view");
  const sp = await props.searchParams;
  const { q, page, pageSize, skip, take } = listParams(sp);
  const [year, classes] = await Promise.all([getActiveYear(), classroomOptions(user)]);
  const classroomId = classes.find((c) => c.id === param(sp, "classe"))?.id;
  const status = STATUSES.find((s) => s === param(sp, "statut")) ?? "ACTIVE";
  const { rows, total } = await listStudents(user, { q, classroomId, status, skip, take });
  const multiSchool = user.scope.level !== "SCHOOL";

  const exportQs = new URLSearchParams({ ...(classroomId ? { classe: classroomId } : {}), statut: status, ...(q ? { q } : {}) }).toString();

  const columns: Column<Row>[] = [
    {
      header: "Élève",
      cell: (r) => (
        <div>
          <Link href={`/espace/eleves/${r.student.id}`} className="font-semibold text-primary hover:underline">
            {r.student.lastName} {r.student.firstName}
          </Link>
          <span className="ml-2 inline-flex flex-wrap gap-1">
            {r.isRepeating && <Badge>Redoublant</Badge>}
            {r.student.disabilities.map((d) => (
              <Badge key={d} tone="info">
                {DISABILITY_LABELS[d]}
              </Badge>
            ))}
          </span>
        </div>
      ),
    },
    { header: "Matricule", cell: (r) => <span className="font-mono text-xs">{r.student.matricule}</span>, hideBelow: "sm" },
    { header: "Classe", cell: (r) => r.classroom.name },
    ...(multiSchool ? [{ header: "Établissement", cell: (r: Row) => r.school.name, hideBelow: "lg" as const }] : []),
    { header: "Sexe", cell: (r) => GENDER_LABELS[r.student.gender], hideBelow: "md" },
    { header: "Naissance", cell: (r) => <span className="whitespace-nowrap tabular-nums">{shortDate(r.student.birthDate)}</span>, hideBelow: "lg" },
    {
      header: "Parent principal",
      cell: (r) => {
        const g = r.student.guardians[0]?.guardian;
        return g ? (
          <span>
            {g.firstName} {g.lastName}
            <span className="block text-xs text-muted">{g.phone}</span>
          </span>
        ) : (
          <span className="text-muted">Non renseigné</span>
        );
      },
      hideBelow: "lg",
    },
    {
      header: "Statut",
      cell: (r) => <Badge tone={r.status === "ACTIVE" ? "success" : "warning"}>{ENROLLMENT_STATUS_LABELS[r.status]}</Badge>,
      hideBelow: "sm",
    },
  ];

  return (
    <>
      <PageHeader
        title="Élèves"
        description={`Inscriptions de l'année ${year?.label ?? ""}.`}
        actions={
          <>
            {can(user, "student:export") && (
              <a
                href={`/api/export/eleves?${exportQs}`}
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 text-sm font-semibold hover:bg-surface-2"
              >
                <Download className="size-4" aria-hidden /> Exporter (CSV)
              </a>
            )}
            {can(user, "student:create") && (
              <ButtonLink href="/espace/eleves/nouveau">
                <Plus aria-hidden /> Inscrire un élève
              </ButtonLink>
            )}
          </>
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <UrlSelect param="classe" label="Classe" value={classroomId} allLabel="Toutes les classes" options={classes.map((c) => ({ value: c.id, label: c.name }))} className="sm:w-52" />
        <UrlSelect
          param="statut"
          label="Statut"
          value={status}
          options={[
            { value: "ACTIVE", label: "Inscrits" },
            { value: "WITHDRAWN", label: "Retirés" },
            { value: "TRANSFERRED", label: "Transférés" },
            { value: "ALL", label: "Tous" },
          ]}
          className="sm:w-52"
        />
      </div>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        total={total}
        page={page}
        pageSize={pageSize}
        searchParams={sp}
        basePath="/espace/eleves"
        searchPlaceholder="Rechercher par nom ou matricule"
        caption="Liste des élèves"
        emptyTitle={q ? "Aucun élève ne correspond à la recherche" : "Aucun élève"}
        emptyDescription={q ? "Vérifiez l'orthographe ou cherchez par matricule." : undefined}
      />
    </>
  );
}
