import { ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/kit/states";
import { PageHeader } from "@/components/kit/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { RightsMatrix } from "@/features/roles/components/rights-matrix";
import { DeleteRoleDialog, EditRoleDialog, RoleFormDialog } from "@/features/roles/components/role-dialogs";
import { canManageRole, canReceiveHolders, creatableLevels } from "@/features/roles/ownership";
import { actorScope, listRolesWithCounts } from "@/features/roles/queries";
import { actorOf } from "@/features/users/queries";
import { can, requirePermission } from "@/lib/auth/authorize";
import { canAssignRole, canEditRoleDetails, isLevelAtOrBelow, planRoleDeletion, PROTECTED_PERMISSIONS, SCOPE_LABELS } from "@/lib/domain/rights";
import { param } from "@/lib/list";
import { cn, formatDateTime, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Rôles et droits" };

export default async function RightsPage({ searchParams }: PageProps<"/espace/droits">) {
  const user = await requirePermission("role:view");
  const sp = await searchParams;
  const roles = await listRolesWithCounts(user);
  const wanted = param(sp, "role");
  // A deleted role (or a stale link) goes back to the list.
  if (wanted && !roles.some((r) => r.id === wanted)) redirect("/espace/droits");
  const selected = roles.find((r) => r.id === wanted) ?? roles[0];

  const actor = actorOf(user);
  const where = actorScope(user);
  const canUpdate = can(user, "role:update");
  // Outside the national level, only the roles of one's own entity are
  // editable; the national roles are shown read only (ownership.ts).
  const managed = selected ? canManageRole(where, selected.owner) : null;
  const editable = !!selected && canUpdate && isLevelAtOrBelow(selected.scopeLevel, user.scope.level) && !!managed?.ok;
  const levels = canUpdate ? creatableLevels(where).map((l) => ({ value: l, label: SCOPE_LABELS[l] })) : [];
  const roleOptions = roles.map((r) => ({ id: r.id, name: r.name, scopeLevel: r.scopeLevel }));
  const national = roles.filter((r) => !r.ownerName);
  const owned = roles.filter((r) => r.ownerName);
  const ownGroupTitle = user.scope.level === "NATIONAL" ? "Rôles créés sur le terrain" : `Rôles de ${user.scope.label}`;
  const ownerNote = user.scope.level === "NATIONAL" ? undefined : `Ce rôle appartiendra à ${user.scope.label} et ne pourra être attribué qu'à son personnel.`;

  // What the delete dialog offers mirrors planRoleDeletion, which the server
  // runs again on submission.
  const targetRoles = selected
    ? roles.filter((r) => r.id !== selected.id && r.scopeLevel === selected.scopeLevel && canAssignRole(actor, r).ok && canReceiveHolders(selected.owner, r.owner).ok)
    : [];
  const targets = targetRoles.map((r) => ({ id: r.id, name: r.name }));
  let blockedReason: string | null = null;
  if (selected && !selected.isSystem) {
    const plan = planRoleDeletion({
      actor,
      role: selected,
      // Only "some" matters for the rule when accounts sit outside the scope.
      holders: { total: selected.users + (selected.heldOutsideScope ? 1 : 0), inScope: selected.users },
      target: targetRoles[0] ?? null,
    });
    const noTarget = selected.users > 0 && !targetRoles.length && !selected.heldOutsideScope && canAssignRole(actor, selected).ok;
    if (!plan.ok) blockedReason = noTarget ? "Aucun rôle du même niveau que vous pouvez attribuer ne peut accueillir ses comptes." : plan.reason;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Rôles et droits"
        info="Un rôle regroupe des droits. Chaque modification est inscrite au journal et s'applique aux titulaires dès leur page suivante."
        actions={levels.length ? <RoleFormDialog mode="create" roles={roleOptions} levels={levels} note={ownerNote} /> : undefined}
      />
      {!canUpdate && (
        <Alert tone="info" title="Consultation seule">
          Votre rôle permet de consulter les droits, pas de les modifier.
        </Alert>
      )}
      {canUpdate && user.scope.level !== "NATIONAL" && (
        <Alert tone="info" title="Rôles nationaux en lecture seule">
          Les rôles nationaux servent partout : seul le ministère les modifie. Créez ici les rôles propres à {user.scope.label}, avec les droits que vous détenez, puis
          attribuez-les depuis « Comptes utilisateurs ».
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        {/* Phone: the roles scroll sideways above the matrix instead of
            pushing it a screen down. */}
        <nav aria-label="Rôles" className="min-w-0">
          {[
            { title: "Rôles nationaux", items: national },
            { title: ownGroupTitle, items: owned },
          ]
            .filter((g) => g.items.length || (g.title === ownGroupTitle && levels.length))
            .map((g) => (
          <div key={g.title} className="mb-3 last:mb-0">
          <h2 className="mb-1.5 text-xs font-bold tracking-wide text-muted uppercase">{g.title}</h2>
          {g.items.length === 0 && <p className="text-sm text-muted">Aucun rôle pour l&apos;instant. Utilisez « Nouveau rôle ».</p>}
          <ul className="relative -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
            {g.items.map((r) => {
              const current = r.id === selected?.id;
              return (
                <li key={r.id} className="max-lg:w-56 max-lg:shrink-0">
                  <Link
                    href={`/espace/droits?role=${r.id}`}
                    aria-current={current ? "page" : undefined}
                    className={cn("flex h-full flex-col gap-1 rounded-lg border px-3 py-2.5 text-sm", current ? "border-primary bg-primary-soft" : "border-border bg-surface hover:bg-surface-2")}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn(current && "font-semibold")}>{r.name}</span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted" title="Comptes titulaires dans votre périmètre">
                        <Users className="size-3.5" aria-hidden />
                        <span className="sr-only">Comptes :</span>
                        {formatNumber(r.users)}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <span>{SCOPE_LABELS[r.scopeLevel]}</span>
                      {!r.isSystem && <Badge tone="accent">Personnalisé</Badge>}
                      {r.ownerName && user.scope.level === "NATIONAL" && <span className="truncate">{r.ownerName}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          </div>
            ))}
        </nav>

        {selected ? (
          <Card className="min-w-0">
            <CardHeader className="flex-col">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="size-5 text-primary" aria-hidden /> {selected.name}
                </CardTitle>
                <p className="mt-1 text-sm text-muted">{selected.description || "Aucune description."}</p>
                <p className="mt-1 text-xs text-muted" data-testid="role-last-change">
                  {selected.lastChange ? (
                    <>
                      Dernière modification le {formatDateTime(selected.lastChange.at)}
                      {selected.lastChange.by ? ` par ${selected.lastChange.by}` : ""} : {selected.lastChange.summary}
                    </>
                  ) : (
                    <>Dernière modification le {formatDateTime(selected.updatedAt)}</>
                  )}{" "}
                  · {formatNumber(selected.permissions.length)} droits
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="info">Niveau : {SCOPE_LABELS[selected.scopeLevel]}</Badge>
                {selected.isSystem ? <Badge>Rôle système</Badge> : <Badge tone="accent">Personnalisé</Badge>}
                <Badge tone={selected.ownerName ? "success" : "neutral"}>{selected.ownerName ? `Propre à ${selected.ownerName}` : "Rôle national"}</Badge>
                <Badge>
                  {formatNumber(selected.users)} compte{selected.users > 1 ? "s" : ""}
                </Badge>
              </div>
            </CardHeader>
            {canUpdate && (levels.length > 0 || editable) && (
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                {levels.length > 0 && (
                  <RoleFormDialog
                    mode="duplicate"
                    roles={roleOptions}
                    levels={levels}
                    note={ownerNote}
                    source={{ id: selected.id, name: selected.name, scopeLevel: selected.scopeLevel, description: selected.description }}
                  />
                )}
                {!selected.isSystem && editable && canEditRoleDetails(actor, selected).ok && <EditRoleDialog role={{ id: selected.id, name: selected.name, description: selected.description }} />}
                {!selected.isSystem && editable && (
                  <DeleteRoleDialog role={{ id: selected.id, name: selected.name, users: selected.users }} targets={targets} blockedReason={blockedReason} />
                )}
                {selected.isSystem && editable && <p className="text-xs text-muted">Rôle système : ni renommable ni supprimable, mais ses droits se modifient.</p>}
              </div>
            )}
            <CardBody className="px-0 py-0">
              {canUpdate && !editable && (
                <Alert tone={managed?.ok ? "warning" : "info"} className="m-4">
                  {managed && !managed.ok ? managed.reason : "Ce rôle agit à un niveau supérieur au vôtre : vous ne pouvez pas le modifier."}
                </Alert>
              )}
              <RightsMatrix
                key={selected.id}
                role={{ id: selected.id, name: selected.name, permissions: selected.permissions }}
                held={[...user.permissions]}
                editable={editable}
                protectedCodes={PROTECTED_PERMISSIONS[selected.code] ?? []}
              />
            </CardBody>
          </Card>
        ) : (
          <EmptyState title="Aucun rôle" />
        )}
      </div>
    </div>
  );
}
