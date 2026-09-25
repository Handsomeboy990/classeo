import { ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/kit/states";
import { PageHeader } from "@/components/kit/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { RightsMatrix } from "@/features/roles/components/rights-matrix";
import { listRolesWithCounts } from "@/features/roles/queries";
import { can, requirePermission } from "@/lib/auth/authorize";
import { isLevelAtOrBelow, PROTECTED_PERMISSIONS, SCOPE_LABELS } from "@/lib/domain/rights";
import { param } from "@/lib/list";
import { cn, formatDateTime, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Rôles et droits" };

export default async function RightsPage({ searchParams }: PageProps<"/espace/droits">) {
  const user = await requirePermission("role:view");
  const sp = await searchParams;
  const roles = await listRolesWithCounts(user);
  const selected = roles.find((r) => r.id === param(sp, "role")) ?? roles[0];

  const canUpdate = can(user, "role:update");
  const editable = !!selected && canUpdate && isLevelAtOrBelow(selected.scopeLevel, user.scope.level);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Rôles et droits"
        description="Un rôle est un ensemble de droits. Chaque modification est journalisée et s'applique dès la page suivante de chaque titulaire."
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
                    className={cn("flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm", current ? "border-primary bg-primary-soft font-semibold" : "border-border bg-surface hover:bg-surface-2")}
                  >
                    <span>{r.name}</span>
                    <span className="inline-flex items-center gap-1 text-xs text-muted" title="Comptes titulaires dans votre périmètre">
                      <Users className="size-3.5" aria-hidden />
                      <span className="sr-only">Comptes :</span>
                      {formatNumber(r.users)}
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
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="size-5 text-primary" aria-hidden /> {selected.name}
                </CardTitle>
                <p className="mt-1 text-sm text-muted">{selected.description}</p>
                <p className="mt-1 text-xs text-muted">
                  Dernière modification le {formatDateTime(selected.updatedAt)} · {formatNumber(selected.permissions.length)} droits
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="info">Niveau : {SCOPE_LABELS[selected.scopeLevel]}</Badge>
                <Badge>
                  {formatNumber(selected.users)} compte{selected.users > 1 ? "s" : ""}
                </Badge>
              </div>
            </CardHeader>
            <CardBody className="px-0 py-0">
              {canUpdate && !editable && (
                <Alert tone="warning" className="m-4">
                  Ce rôle agit à un niveau supérieur au vôtre : vous ne pouvez pas le modifier.
                </Alert>
              )}
              <RightsMatrix
                key={`${selected.id}-${selected.updatedAt.toISOString()}`}
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
