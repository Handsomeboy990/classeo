import { ArrowRight, Check, History, X } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ConfirmButton } from "@/components/kit/confirm-button";
import { FormDialog } from "@/components/kit/form-dialog";
import { FormField } from "@/components/kit/form-field";
import { PageHeader } from "@/components/kit/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, Textarea } from "@/components/ui/input";
import { StudentAvatar } from "@/features/students/components/student-avatar";
import { cancelTransfer, decideAsDestination, decideAsGuardian } from "@/features/transfers/actions";
import { TransfersOff } from "@/features/transfers/components/module-off";
import { TransferStatusBadge, TransferTimeline } from "@/features/transfers/components/transfer-timeline";
import { isPending, KIND_LABELS } from "@/features/transfers/logic";
import { destinationClasses, getTransfer, originLevelName } from "@/features/transfers/queries";
import { can, requirePermission } from "@/lib/auth/authorize";
import { isEnabled } from "@/lib/features";
import { PdfDownloadLink } from "@/lib/pdf/download-link";

export const metadata: Metadata = { title: "Transfert" };

export default async function TransferPage(props: PageProps<"/espace/transferts/[id]">) {
  const user = await requirePermission(["student:view", "report_card:view"]);
  const { id } = await props.params;
  const detail = await getTransfer(user, id);
  if (!detail) notFound();
  const enabled = await isEnabled("students.transfers");
  const { transfer: t, timeline } = detail;
  const s = t.student;
  const name = `${s.firstName} ${s.lastName}`;
  const schoolId = user.scope.level === "SCHOOL" ? user.scope.schoolId : null;
  const isOrigin = schoolId === t.fromSchoolId;
  const isDestination = schoolId === t.toSchoolId && t.kind === "SCHOOL_CHANGE";
  const primary = s.guardians.find((g) => g.isPrimary)?.guardian;
  const isPrimaryGuardian = !!user.guardianId && primary?.id === user.guardianId;
  const isFamily = user.scope.level === "SELF";
  const pending = isPending(t.status);

  const guardianTurn = enabled && isPrimaryGuardian && t.status === "PENDING_GUARDIAN";
  const destinationTurn = enabled && isDestination && can(user, "student:create") && t.status === "PENDING_DESTINATION";
  const originCanCancel = enabled && isOrigin && can(user, "student:update") && pending;
  const [classes, originLevel] = destinationTurn ? await Promise.all([destinationClasses(t.toSchoolId), originLevelName(t.fromClassroomId)]) : [[], null];
  const certificate = t.kind === "SCHOOL_CHANGE" && t.status === "ACCEPTED" && can(user, "student:view");
  const historyHref = isFamily ? `/espace/suivi/${s.id}/parcours` : `/espace/eleves/${s.id}/parcours`;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Transferts", href: "/espace/transferts" }, { label: name }]}
        title={`Transfert de ${name}`}
        description={`${KIND_LABELS[t.kind]} · ${t.fromSchool.name}${t.kind === "SCHOOL_CHANGE" ? ` vers ${t.toSchool.name}` : ""}`}
        actionsPlacement="below"
        actions={
          <>
            {certificate && (
              <PdfDownloadLink href={`/espace/transferts/${t.id}/certificat`} label="Certificat de radiation, exeat (PDF)" description={`certificat de radiation de ${name}`} />
            )}
            <ButtonLink href={historyHref} variant="secondary">
              <History aria-hidden /> Parcours de l&apos;élève
            </ButtonLink>
            {originCanCancel && (
              <FormDialog
                action={cancelTransfer}
                trigger="Annuler le transfert"
                triggerVariant="danger-ghost"
                title={`Annuler le transfert de ${name} ?`}
                description="L'élève reste inscrit dans votre établissement. La famille et l'établissement d'accueil sont prévenus."
                submitLabel="Annuler le transfert"
                cancelLabel="Retour"
              >
                <input type="hidden" name="transferId" value={t.id} />
                <FormField label="Motif (facultatif)" name="note">
                  <Textarea rows={3} maxLength={300} />
                </FormField>
              </FormDialog>
            )}
          </>
        }
      />

      {!enabled && pending && (
        <div className="mb-4">
          <TransfersOff />
        </div>
      )}

      {guardianTurn && (
        <section aria-labelledby="guardian-question" className="mb-6 rounded-card border-2 border-primary bg-primary-soft p-5">
          <h2 id="guardian-question" className="text-xl font-bold">
            Êtes-vous d&apos;accord pour que {s.firstName} change d&apos;école ?
          </h2>
          <p className="mt-2 text-base">
            {t.fromSchool.name} propose que {s.firstName} aille à <strong>{t.toSchool.name}</strong> ({t.toSchool.commune.name}). Motif : {t.reason}.
          </p>
          <p className="mt-1 text-sm text-muted">
            {t.shareHistory ? "Les bulletins et les présences de votre enfant seront transmis à la nouvelle école." : "Le dossier scolaire ne sera pas transmis à la nouvelle école."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3 max-sm:*:grow">
            <ConfirmButton
              action={decideAsGuardian}
              fields={{ transferId: t.id, decision: "approve" }}
              title="Confirmer votre accord ?"
              description={`${name} ira à ${t.toSchool.name} si l'école accepte. Vous recevrez une notification.`}
              confirmLabel="Oui, je suis d'accord"
              tone="primary"
              variant="primary"
              size="lg"
            >
              <Check aria-hidden /> Oui, je suis d&apos;accord
            </ConfirmButton>
            <FormDialog
              action={decideAsGuardian}
              trigger={
                <>
                  <X aria-hidden /> Non, je refuse
                </>
              }
              triggerVariant="secondary"
              triggerSize="lg"
              title="Refuser le transfert ?"
              description={`${name} reste à ${t.fromSchool.name}.`}
              submitLabel="Je refuse"
            >
              <input type="hidden" name="transferId" value={t.id} />
              <input type="hidden" name="decision" value="refuse" />
              <FormField label="Pourquoi ? (facultatif)" name="note">
                <Textarea rows={3} maxLength={300} />
              </FormField>
            </FormDialog>
          </div>
        </section>
      )}

      {destinationTurn && (
        <Alert
          tone="info"
          className="mb-6"
          title="Demande d'accueil pour votre établissement"
          action={
            <>
              <FormDialog
                action={decideAsDestination}
                trigger="Accepter et choisir la classe"
                title={`Accueillir ${name}`}
                description={`Venant de ${t.fromSchool.name}${detail.fromClassroom ? `, ${detail.fromClassroom}` : ""}. L'élève sera inscrit(e) aujourd'hui dans la classe choisie.`}
                submitLabel="Accepter"
              >
                <input type="hidden" name="transferId" value={t.id} />
                <input type="hidden" name="decision" value="accept" />
                <FormField label="Classe d'accueil" name="toClassroomId" required hint={originLevel ? `Niveau actuel de l'élève : ${originLevel}.` : undefined}>
                  <Select defaultValue="">
                    <option value="" disabled>
                      Choisir une classe
                    </option>
                    {classes.map((c) => {
                      const full = c._count.enrollments >= c.capacity;
                      return (
                        <option key={c.id} value={c.id} disabled={full}>
                          {c.name} ({c._count.enrollments}/{c.capacity}
                          {full ? ", complète" : ""})
                        </option>
                      );
                    })}
                  </Select>
                </FormField>
                <FormField label="Note (facultative)" name="note">
                  <Textarea rows={2} maxLength={300} />
                </FormField>
              </FormDialog>
              <FormDialog
                action={decideAsDestination}
                trigger="Refuser"
                triggerVariant="secondary"
                title={`Refuser l'accueil de ${name} ?`}
                description="Le motif est envoyé à la famille et à l'établissement d'origine."
                submitLabel="Refuser"
              >
                <input type="hidden" name="transferId" value={t.id} />
                <input type="hidden" name="decision" value="refuse" />
                <FormField label="Motif du refus" name="note" required>
                  <Textarea rows={3} maxLength={300} />
                </FormField>
              </FormDialog>
            </>
          }
        >
          Le parent a donné son accord. Choisissez la classe de l&apos;élève ou refusez en expliquant pourquoi.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Demande</CardTitle>
            <TransferStatusBadge status={t.status} />
          </CardHeader>
          <CardBody className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <StudentAvatar name={name} photoFileId={s.photoFileId} className="size-16 text-xl" />
              <div className="min-w-0">
                <p className="text-lg font-bold">{name}</p>
                <p className="text-sm text-muted tabular-nums">{s.matricule}</p>
              </div>
            </div>
            <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
              <div className="rounded-control border border-border p-3">
                <p className="font-display text-[0.6875rem] font-bold tracking-[0.08em] text-muted uppercase">Départ</p>
                <p className="font-semibold">{t.fromSchool.name}</p>
                <p className="text-sm text-muted">
                  {detail.fromClassroom ?? "–"} · {t.fromSchool.commune.name}
                </p>
              </div>
              <ArrowRight className="size-5 justify-self-center text-muted max-sm:rotate-90" aria-hidden />
              <div className="rounded-control border border-border p-3">
                <p className="font-display text-[0.6875rem] font-bold tracking-[0.08em] text-muted uppercase">Arrivée</p>
                <p className="font-semibold">{t.toSchool.name}</p>
                <p className="text-sm text-muted">
                  {detail.toClassroom ?? "Classe à choisir"} · {t.toSchool.commune.name}
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">Motif</dt>
              <dd>{t.reason}</dd>
              {t.kind === "SCHOOL_CHANGE" && (
                <>
                  <dt className="text-muted">Dossier scolaire</dt>
                  <dd>{t.shareHistory ? <Badge tone="success" className="whitespace-normal">Transmis à l&apos;établissement d&apos;accueil</Badge> : <Badge>Non transmis</Badge>}</dd>
                  <dt className="text-muted">Parent principal</dt>
                  <dd>
                    {primary ? `${primary.firstName} ${primary.lastName}` : "Non renseigné"}
                    {primary && !primary.userId && <span className="block text-muted">Sans compte Classéo : accord recueilli par l&apos;école</span>}
                  </dd>
                </>
              )}
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Étapes</CardTitle>
          </CardHeader>
          <CardBody>
            <TransferTimeline input={timeline} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
