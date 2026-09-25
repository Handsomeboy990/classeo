import { Download, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DataTable, type Column } from "@/components/kit/data-table";
import { PageHeader } from "@/components/kit/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, buttonVariants } from "@/components/ui/button";
import { getActiveYear } from "@/features/classes/academic";
import { UrlSelect } from "@/components/kit/url-select";
import { classroomOptions } from "@/features/classes/queries";
import { DISABILITY_LABELS, ENROLLMENT_STATUS_LABELS, GENDER_LABELS, shortDate } from "@/features/students/labels";
import { listStudents } from "@/features/students/queries";
import { StudentAvatar } from "@/features/students/components/student-avatar";
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
      primary: true,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <StudentAvatar name={`${r.student.firstName} ${r.student.lastName}`} photoFileId={r.student.photoFileId} />
          <div className="min-w-0">
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
        </div>
      ),
    },
    { header: "Matricule", cell: (r) => <span className="font-mono text-xs">{r.student.matricule}</span>, hideBelow: "sm" },
    { header: "Classe", cell: (r) => r.classroom.name },
    ...(multiSchool ? [{ header: "Établissement", cell: (r: Row) => r.school.name, hideBelow: "lg" as const }] : []),
    { header: "Sexe", cell: (r) => GENDER_LABELS[r.student.gender], hideBelow: "md", mobileHidden: true },
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
      // Every row says "Inscrit" under the default filter: not worth a line per card.
      mobileHidden: status === "ACTIVE",
    },
  ];

  return (
    <>
      <PageHeader
        title="Élèves"
        description={year ? `Année scolaire ${year.label}` : undefined}
        actions={
          <>
            {can(user, "student:export") && (
              <a href={`/api/export/eleves?${exportQs}`} className={buttonVariants({ variant: "secondary" })}>
                <Download aria-hidden /> Exporter (CSV)
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
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        rowHref={(r) => `/espace/eleves/${r.student.id}`}
        total={total}
        page={page}
        pageSize={pageSize}
        searchParams={sp}
        basePath="/espace/eleves"
        searchPlaceholder="Nom ou matricule"
        toolbar={
          <>
            <UrlSelect param="classe" label="Classe" hideLabel value={classroomId ?? ""} allLabel="Toutes les classes" options={classes.map((c) => ({ value: c.id, label: c.name }))} className="sm:w-48" />
            <UrlSelect
              param="statut"
              label="Statut"
              hideLabel
              value={status}
              options={[
                { value: "ACTIVE", label: "Inscrits" },
                { value: "WITHDRAWN", label: "Retirés" },
                { value: "TRANSFERRED", label: "Transférés" },
                { value: "ALL", label: "Tous les statuts" },
              ]}
              className="sm:w-44"
            />
          </>
        }
        caption="Liste des élèves"
        emptyTitle={q ? "Aucun élève ne correspond à la recherche" : "Aucun élève"}
        emptyDescription={q ? "Vérifiez l'orthographe ou cherchez par matricule." : undefined}
      />
    </>
  );
}
