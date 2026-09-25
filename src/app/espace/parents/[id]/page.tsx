import { Unlink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/kit/page-header";
import { EmptyState } from "@/components/kit/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/kit/confirm-button";
import { removeChild } from "@/features/parents/actions";
import { AddChildDialog, EditGuardianDialog } from "@/features/parents/components/parent-forms";
import { getGuardian, studentChoices } from "@/features/parents/queries";
import { CHANNEL_LABELS, ENROLLMENT_STATUS_LABELS } from "@/features/students/labels";
import { can, requirePermission } from "@/lib/auth/authorize";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Parent" };

export default async function ParentPage(props: PageProps<"/espace/parents/[id]">) {
  const user = await requirePermission("parent:view");
  const { id } = await props.params;
  const g = await getGuardian(user, id);
  if (!g) notFound();
  const canUpdate = can(user, "parent:update");
  const students = canUpdate ? await studentChoices(user) : [];
  const name = `${g.firstName} ${g.lastName}`;
  const linked = new Set(g.students.map((s) => s.studentId));

  return (
    <>
      <nav aria-label="Fil d'Ariane" className="mb-2 text-sm text-muted">
        <Link href="/espace/parents" className="hover:underline">
          Parents
        </Link>{" "}
        / {name}
      </nav>
      <PageHeader
        title={name}
        description={`${g.phone}${g.profession ? ` · ${g.profession}` : ""}`}
        actions={
          canUpdate && (
            <>
              <AddChildDialog guardianId={g.id} students={students.filter((s) => !linked.has(s.student.id))} />
              <EditGuardianDialog
                values={{ id: g.id, lastName: g.lastName, firstName: g.firstName, phone: g.phone, profession: g.profession, preferredChannel: g.preferredChannel, prefersAudio: g.prefersAudio }}
              />
            </>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Enfants ({g.students.length})</CardTitle>
          </CardHeader>
          {g.students.length === 0 ? (
            <EmptyState title="Aucun enfant rattaché" />
          ) : (
            <ul className="divide-y divide-border">
              {g.students.map(({ student: s, relationship, isPrimary }) => {
                const e = s.enrollments[0];
                return (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div>
                      <Link href={`/espace/eleves/${s.id}`} className="font-semibold text-primary hover:underline">
                        {s.firstName} {s.lastName}
                      </Link>
                      <span className="block text-muted">
                        {relationship} · <span className="font-mono">{s.matricule}</span>
                        {e ? ` · ${e.classroom.name}` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isPrimary && <Badge tone="success">Parent principal</Badge>}
                      {e && e.status !== "ACTIVE" && <Badge tone="warning">{ENROLLMENT_STATUS_LABELS[e.status]}</Badge>}
                      {canUpdate && s._count.guardians > 1 && g.students.length > 1 && (
                        <ConfirmButton
                          action={removeChild}
                          fields={{ guardianId: g.id, studentId: s.id }}
                          variant="ghost"
                          size="sm"
                          label={`Détacher ${s.firstName} ${s.lastName}`}
                          title={`Détacher ${s.firstName} ${s.lastName} de ${name} ?`}
                          description="Le parent ne recevra plus les notifications concernant cet enfant."
                          confirmLabel="Détacher"
                        >
                          <Unlink aria-hidden />
                        </ConfirmButton>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <dt className="text-muted">Téléphone</dt>
              <dd>
                <a href={`tel:${g.phone}`} className="font-mono hover:underline">
                  {g.phone}
                </a>
              </dd>
              <dt className="text-muted">Canal préféré</dt>
              <dd>{CHANNEL_LABELS[g.preferredChannel]}</dd>
              <dt className="text-muted">Messages audio</dt>
              <dd>{g.prefersAudio ? "Oui" : "Non"}</dd>
              <dt className="text-muted">Compte</dt>
              <dd>{g.user ? g.user.email : "Aucun compte"}</dd>
              {g.user?.lastLoginAt && (
                <>
                  <dt className="text-muted">Dernière connexion</dt>
                  <dd>{formatDateTime(g.user.lastLoginAt)}</dd>
                </>
              )}
            </dl>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
