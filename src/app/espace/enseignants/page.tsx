import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DataTable, type Column } from "@/components/kit/data-table";
import { PageHeader } from "@/components/kit/page-header";
import { UrlSelect } from "@/components/kit/url-select";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { AddTeacherDialog } from "@/features/teachers/components/add-teacher-dialog";
import { listTeachers } from "@/features/teachers/queries";
import { listRegistry, registryFilterOptions, registryFilters } from "@/features/teachers/registry";
import { FilterBar, type FilterField } from "@/features/territory/components/filter-bar";
import { can, requirePermission } from "@/lib/auth/authorize";
import type { CurrentUser } from "@/lib/auth/session";
import { listParams, param, type SearchParams } from "@/lib/list";

export const metadata: Metadata = { title: "Enseignants" };

type User = NonNullable<CurrentUser>;
type Row = Awaited<ReturnType<typeof listTeachers>>["rows"][number];
type RegistryRow = Awaited<ReturnType<typeof listRegistry>>["rows"][number];

export default async function TeachersPage(props: PageProps<"/espace/enseignants">) {
  const user = await requirePermission("teacher:view");
  const sp = await props.searchParams;
  // The ministry, departments and communes read the national registry of
  // their territory; a school its own team.
  return user.scope.level === "SCHOOL" ? <SchoolTeachers user={user} sp={sp} /> : <Registry user={user} sp={sp} />;
}

async function SchoolTeachers({ user, sp }: { user: User; sp: SearchParams }) {
  const { q, page, pageSize, skip, take } = listParams(sp);
  const statut = param(sp, "statut");
  const active = statut === "tous" ? null : statut !== "inactifs";
  const { rows, total } = await listTeachers(user, { q, active, skip, take });

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
      cell: (r) => {
        const elsewhere = r.profile?.teachers.filter((t) => t.schoolId !== r.schoolId) ?? [];
        return (
          <span className="flex flex-wrap gap-1">
            <Badge tone={r.isActive ? "success" : "neutral"}>{r.isActive ? "En activité" : "Inactif"}</Badge>
            {r.userId && <Badge tone="info">Compte</Badge>}
            {elsewhere.length > 0 && <Badge tone="accent" title={elsewhere.map((t) => t.school.name).join(", ")}>Aussi à {elsewhere.map((t) => t.school.name).join(", ")}</Badge>}
          </span>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Enseignants"
        description="Équipe pédagogique de l'année active. Un enseignant qui travaille aussi dans une autre école garde une seule fiche au registre national."
        actions={can(user, "teacher:create") && user.scope.schoolId && <AddTeacherDialog />}
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

async function Registry({ user, sp }: { user: User; sp: SearchParams }) {
  const { page, pageSize, skip, take } = listParams(sp);
  const filters = registryFilters(sp);
  const [{ rows, total }, options] = await Promise.all([listRegistry(user, filters, { skip, take }), registryFilterOptions(user)]);

  const columns: Column<RegistryRow>[] = [
    {
      header: "Enseignant",
      primary: true,
      cell: (r) => (
        <div>
          <p className="font-semibold">
            {r.lastName} {r.firstName}
          </p>
          <span className="block font-mono text-xs text-muted">{r.npi ? `NPI ${r.npi}` : "Sans NPI"}</span>
        </div>
      ),
    },
    {
      header: "Établissements",
      cell: (r) => (
        <ul className="flex flex-col gap-0.5">
          {r.teachers.map((t) => (
            <li key={t.id}>
              <Link href={`/espace/enseignants/${t.id}`} className="text-primary hover:underline">
                {t.school.name}
              </Link>
              <span className="text-xs text-muted">
                {" "}
                {t.school.commune.name}
                {user.scope.level === "NATIONAL" ? `, ${t.school.commune.department.name}` : ""}
                {t.specialty ? ` · ${t.specialty}` : ""}
              </span>
            </li>
          ))}
          {r._count.teachers > r.teachers.length && (
            <li className="text-xs text-muted">
              et {r._count.teachers - r.teachers.length} hors de votre périmètre
            </li>
          )}
        </ul>
      ),
    },
    {
      header: "Statut",
      cell: (r) => (
        <span className="flex flex-wrap gap-1">
          {r._count.teachers > 1 && <Badge tone="accent">{r._count.teachers} établissements</Badge>}
          {r.userId && <Badge tone="info">Compte</Badge>}
        </span>
      ),
      hideBelow: "sm",
    },
  ];

  const fields: FilterField[] = [
    ...(options.departments.length
      ? [{ kind: "select" as const, name: "departement", label: "Département", value: filters.departmentId, allLabel: "Tous les départements", options: options.departments }]
      : []),
    ...(options.communes.length ? [{ kind: "select" as const, name: "commune", label: "Commune", value: filters.communeId, allLabel: "Toutes les communes", options: options.communes }] : []),
    {
      kind: "select",
      name: "plusieurs",
      label: "Nominations",
      value: filters.multi ? "oui" : null,
      allLabel: "Tous les enseignants",
      options: [{ value: "oui", label: "Dans plusieurs établissements" }],
    },
  ];

  const exportQuery = new URLSearchParams();
  for (const k of ["q", "departement", "commune", "plusieurs"]) {
    const v = sp[k];
    if (typeof v === "string" && v) exportQuery.set(k, v);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Registre des enseignants"
        description={`Une fiche par personne, avec ses établissements : ${user.scope.label}.`}
        actions={
          can(user, "teacher:export") && (
            <ButtonLink href={`/api/export/enseignants${exportQuery.size ? `?${exportQuery}` : ""}`} variant="secondary" prefetch={false}>
              <Download aria-hidden /> Exporter en CSV
            </ButtonLink>
          )
        }
      />
      <FilterBar basePath="/espace/enseignants" keep={{ q: filters.q }} fields={fields} />
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        total={total}
        page={page}
        pageSize={pageSize}
        searchParams={sp}
        basePath="/espace/enseignants"
        searchPlaceholder="Nom, prénom ou NPI"
        caption="Registre des enseignants de votre périmètre"
        emptyTitle="Aucun enseignant"
        emptyDescription="Aucun enseignant ne correspond à ces critères dans votre périmètre."
      />
    </div>
  );
}
