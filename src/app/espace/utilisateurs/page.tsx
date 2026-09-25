import { Download } from "lucide-react";
import type { Metadata } from "next";

import { DataTable, type Column } from "@/components/kit/data-table";
import { PageHeader } from "@/components/kit/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { FilterBar } from "@/features/territory/components/filter-bar";
import { CreateUserDialog } from "@/features/users/components/create-user-dialog";
import { UserRowActions } from "@/features/users/components/user-row-actions";
import { assignableRoles, entityOptions, listUsers, roleFilterOptions, userFilters } from "@/features/users/queries";
import { can, requirePermission } from "@/lib/auth/authorize";
import { listParams } from "@/lib/list";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Comptes utilisateurs" };

type Row = Awaited<ReturnType<typeof listUsers>>["rows"][number];

function scopeOf(u: Row) {
  return u.school?.name ?? u.commune?.name ?? u.department?.name ?? (u.scopeLevel === "NATIONAL" ? "Bénin" : "Personnel");
}

export default async function UsersPage({ searchParams }: PageProps<"/espace/utilisateurs">) {
  const user = await requirePermission("user:view");
  const sp = await searchParams;
  const filters = userFilters(sp);
  const page = listParams(sp);
  const canCreate = can(user, "user:create");
  const canUpdate = can(user, "user:update");

  const [{ rows, total }, roles, assignable, entities] = await Promise.all([
    listUsers(user, filters, page),
    roleFilterOptions(),
    canCreate ? assignableRoles(user) : Promise.resolve([]),
    canCreate ? entityOptions(user) : Promise.resolve({ DEPARTMENT: [], COMMUNE: [], SCHOOL: [] }),
  ]);

  const columns: Column<Row>[] = [
    {
      header: "Nom",
      primary: true,
      cell: (u) => (
        <div>
          <p className="font-semibold">
            {u.firstName} {u.lastName}
          </p>
          <p className="text-xs break-all text-muted">{u.email}</p>
        </div>
      ),
    },
    { header: "Rôle", cell: (u) => u.role.name },
    { header: "Périmètre", cell: scopeOf, hideBelow: "md" },
    { header: "Dernière connexion", cell: (u) => (u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Jamais"), hideBelow: "lg" },
    {
      header: "Statut",
      cell: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.isActive ? <Badge tone="success">Actif</Badge> : <Badge tone="danger">Désactivé</Badge>}
          {u.mustChangePassword && <Badge tone="warning">Mot de passe à changer</Badge>}
          {u.lockedUntil && u.lockedUntil > new Date() && <Badge tone="danger">Verrouillé</Badge>}
        </div>
      ),
    },
    ...(canUpdate
      ? [
          {
            header: "Actions",
            actions: true,
            className: "text-right",
            cell: (u: Row) =>
              u.manageable ? (
                <UserRowActions id={u.id} name={`${u.firstName} ${u.lastName}`} isActive={u.isActive} sessions={u._count.sessions} />
              ) : (
                <span className="text-xs text-muted">{u.id === user.id ? "Votre compte" : "Droits supérieurs"}</span>
              ),
          },
        ]
      : []),
  ];

  const exportQuery = new URLSearchParams();
  for (const k of ["q", "role", "statut"]) {
    const v = sp[k];
    if (typeof v === "string" && v) exportQuery.set(k, v);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Comptes utilisateurs"
        description={`Comptes de votre périmètre : ${user.scope.label}. Un rôle ne peut être attribué que si vous détenez tous ses droits.`}
        actions={
          <>
            {can(user, "user:export") && (
              <ButtonLink href={`/api/export/utilisateurs${exportQuery.size ? `?${exportQuery}` : ""}`} variant="secondary" prefetch={false}>
                <Download aria-hidden /> Exporter en CSV
              </ButtonLink>
            )}
            {canCreate && <CreateUserDialog roles={assignable} entities={entities} />}
          </>
        }
      />
      <FilterBar
        basePath="/espace/utilisateurs"
        keep={{ q: filters.q }}
        fields={[
          { kind: "select", name: "role", label: "Rôle", value: filters.roleId, allLabel: "Tous les rôles", options: roles.map((r) => ({ value: r.id, label: r.name })) },
          {
            kind: "select",
            name: "statut",
            label: "Statut",
            value: filters.status,
            allLabel: "Tous",
            options: [
              { value: "active", label: "Actifs" },
              { value: "inactive", label: "Désactivés" },
            ],
          },
        ]}
      />
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(u) => u.id}
        total={total}
        page={page.page}
        pageSize={page.pageSize}
        searchParams={sp}
        basePath="/espace/utilisateurs"
        searchPlaceholder="Rechercher par nom ou e-mail…"
        caption="Comptes utilisateurs de votre périmètre"
        emptyTitle="Aucun compte"
        emptyDescription="Aucun compte ne correspond à ces critères dans votre périmètre."
      />
    </div>
  );
}
