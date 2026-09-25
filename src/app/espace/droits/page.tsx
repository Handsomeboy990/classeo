import { ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/kit/states";
import { PageHeader } from "@/components/kit/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { RightsMatrix } from "@/features/roles/components/rights-matrix";
import { DeleteRoleDialog, EditRoleDialog, RoleFormDialog } from "@/features/roles/components/role-dialogs";
import { listRolesWithCounts } from "@/features/roles/queries";
import { actorOf } from "@/features/users/queries";
import { can, requirePermission } from "@/lib/auth/authorize";
import { canAssignRole, canEditRoleDetails, CUSTOM_ROLE_LEVELS, isLevelAtOrBelow, planRoleDeletion, PROTECTED_PERMISSIONS, SCOPE_LABELS } from "@/lib/domain/rights";
import { param } from "@/lib/list";
import { cn, formatDateTime, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Rôles et droits" };

export default async function RightsPage({ searchParams }: PageProps<"/espace/droits">) {
  const user = await requirePermission("role:view");
  const sp = await searchParams;
  const roles = await listRolesWithCounts(user);
  const selected = roles.find((r) => r.id === param(sp, "role")) ?? roles[0];

  const actor = actorOf(user);
  const canUpdate = can(user, "role:update");
  const editable = !!selected && canUpdate && isLevelAtOrBelow(selected.scopeLevel, user.scope.level);
  const levels = CUSTOM_ROLE_LEVELS.filter((l) => isLevelAtOrBelow(l, user.scope.level)).map((l) => ({ value: l, label: SCOPE_LABELS[l] }));
  const roleOptions = roles.map((r) => ({ id: r.id, name: r.name, scopeLevel: r.scopeLevel }));

  // What the delete dialog offers mirrors planRoleDeletion, which the server
  // runs again on submission.
  const targetRoles = selected ? roles.filter((r) => r.id !== selected.id && r.scopeLevel === selected.scopeLevel && canAssignRole(actor, r).ok) : [];
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
        description="Un rôle est un ensemble de droits. Chaque modification est journalisée et s'applique dès la page suivante de chaque titulaire."
        actions={canUpdate ? <RoleFormDialog mode="create" roles={roleOptions} levels={levels} /> : undefined}
      />
      {!canUpdate && (
        <Alert tone="info" title="Consultation seule">
          Votre rôle permet de consulter les droits, pas de les modifier.
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <nav aria-label="Rôles">
          <ul className="flex flex-col gap-1.5">
            {roles.map((r) => {
              const current = r.id === selected?.id;
              return (
                <li key={r.id}>
                  <Link
                    href={`/espace/droits?role=${r.id}`}
                    aria-current={current ? "page" : undefined}
                    className={cn("flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-sm", current ? "border-primary bg-primary-soft" : "border-border bg-surface hover:bg-surface-2")}
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
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {selected ? (
          <Card>
            <CardHeader className="flex-col sm:flex-row">
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
              <div className="flex flex-wrap content-start gap-2 sm:justify-end">
                <Badge tone="info">Niveau : {SCOPE_LABELS[selected.scopeLevel]}</Badge>
                {selected.isSystem ? <Badge>Rôle système</Badge> : <Badge tone="accent">Personnalisé</Badge>}
                <Badge>
                  {formatNumber(selected.users)} compte{selected.users > 1 ? "s" : ""}
                </Badge>
              </div>
            </CardHeader>
            {canUpdate && (
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                <RoleFormDialog mode="duplicate" roles={roleOptions} levels={levels} source={{ id: selected.id, name: selected.name, scopeLevel: selected.scopeLevel, description: selected.description }} />
                {!selected.isSystem && canEditRoleDetails(actor, selected).ok && <EditRoleDialog role={{ id: selected.id, name: selected.name, description: selected.description }} />}
                {!selected.isSystem && editable && (
                  <DeleteRoleDialog role={{ id: selected.id, name: selected.name, users: selected.users }} targets={targets} blockedReason={blockedReason} />
                )}
                {selected.isSystem && <p className="text-xs text-muted">Rôle système : il ne peut être ni renommé ni supprimé, ses droits restent modifiables.</p>}
              </div>
            )}
            <CardBody className="px-0 py-0">
              {canUpdate && !editable && (
                <Alert tone="warning" className="m-4">
                  Ce rôle agit à un niveau supérieur au vôtre : vous ne pouvez pas le modifier.
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
