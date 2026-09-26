import { CalendarX2, FileCheck2, FolderOpen, HeartPulse, Paperclip } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FormDialog } from "@/components/kit/form-dialog";
import { FormField } from "@/components/kit/form-field";
import { InfoTip } from "@/components/kit/info-tip";
import { PageHeader } from "@/components/kit/page-header";
import { EmptyState } from "@/components/kit/states";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { submitFamilyDocument } from "@/features/family-documents/actions";
import { PieceFileField } from "@/features/family-documents/components/forms";
import { familyEnrollments, familyFile, markSeen, type FamilyDocRow } from "@/features/family-documents/queries";
import { canSendAgain, STATUS_LABELS, STATUS_TONES } from "@/features/family-documents/rules";
import { requirePermission } from "@/lib/auth/authorize";
import { todayIso } from "@/lib/domain/attendance";
import { fileUrl } from "@/lib/files";
import { param } from "@/lib/list";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Pièces et justificatifs" };

// The latest answer on a piece: its status, the school's message, the file.
function Latest({ doc }: { doc: FamilyDocRow | undefined }) {
  if (!doc) return <Badge tone="neutral">À envoyer</Badge>;
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge tone={STATUS_TONES[doc.status]}>{STATUS_LABELS[doc.status]}</Badge>
      <p className="text-xs text-muted">
        Envoyée le {formatDate(doc.createdAt)}
        {doc.reviewedAt ? `, réponse le ${formatDate(doc.reviewedAt)}` : ""}
      </p>
      {doc.status === "REJECTED" && doc.reviewNote && <p className="text-sm">Motif : {doc.reviewNote}</p>}
      {doc.fileId && doc.file ? (
        <a href={fileUrl(doc.fileId)!} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline" target="_blank" rel="noopener">
          <Paperclip className="size-4" aria-hidden /> Voir le fichier envoyé
        </a>
      ) : doc.fileRemovedAt ? (
        <p className="text-xs text-muted">Fichier supprimé après vérification, comme pour toute pièce de santé.</p>
      ) : null}
    </div>
  );
}

export default async function FamilyPiecesPage({ searchParams }: PageProps<"/espace/pieces-justificatifs">) {
  const user = await requirePermission("family_document:create");
  const sp = await searchParams;
  const children = await familyEnrollments(user);
  const isParent = !!user.guardianId;

  if (!children.length) {
    return (
      <>
        <PageHeader title="Pièces et justificatifs" />
        <EmptyState icon={<FolderOpen className="size-7" />} title="Aucun enfant inscrit cette année" description="Les pièces à envoyer apparaissent dès qu'une inscription de l'année est rattachée à votre compte." />
      </>
    );
  }

  const wanted = param(sp, "enfant");
  const current = children.find((c) => c.student.id === wanted) ?? children[0]!;
  const today = todayIso();
  const [file] = await Promise.all([familyFile(user, current, today), markSeen(user, `/espace/pieces-justificatifs?enfant=${current.student.id}`)]);
  const child = current.student.firstName;
  const canSend = !file.blocked;
  const toJustify = file.absences.filter((a) => a.status === "ABSENT" && canSendAgain(a.docs));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pièces et justificatifs"
        description={isParent ? "Envoyez à l'école les pièces du dossier, justifiez une absence ou transmettez un certificat médical. L'école vous répond ici." : "Envoyez à l'école les pièces de votre dossier et justifiez vos absences. L'école vous répond ici."}
      />

      {children.length > 1 && (
        <nav aria-label="Choisir l'enfant" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {children.map((c) => {
            const on = c.id === current.id;
            return (
              <Link
                key={c.id}
                href={`/espace/pieces-justificatifs?enfant=${c.student.id}`}
                aria-current={on ? "page" : undefined}
                className={cn("inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap", on ? "border-primary bg-primary text-on-primary" : "border-border-strong hover:bg-surface-2")}
              >
                {c.student.firstName} {c.student.lastName}
                <span className="ml-1 font-normal opacity-80">, {c.classroom.name}</span>
              </Link>
            );
          })}
        </nav>
      )}

      {file.blocked && (
        <Alert tone="info" title="Vos parents envoient les pièces pour vous">
          {file.blocked}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck2 className="size-5 text-primary" aria-hidden /> Dossier d&apos;inscription
          </CardTitle>
          <p className="text-sm text-muted">
            {current.school.name}, {current.classroom.name}
          </p>
        </CardHeader>
        <CardBody>
          {file.pieces.length === 0 ? (
            <p className="text-sm text-muted">L&apos;école n&apos;a demandé aucune pièce pour {child} pour le moment.</p>
          ) : (
            <ul className="divide-y divide-border">
              {file.pieces.map((p) => {
                const latest = p.docs[0];
                const open = canSend && canSendAgain(p.docs);
                return (
                  <li key={p.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        {p.label}
                        {p.isHealth && (
                          <>
                            <Badge tone="info">Pièce de santé</Badge>
                            <InfoTip label={`À propos de la pièce de santé ${p.label}`}>
                              L&apos;école vérifie la pièce, puis le fichier est supprimé. Seule la réponse est gardée : c&apos;est une donnée de santé, protégée par la loi.
                            </InfoTip>
                          </>
                        )}
                      </p>
                      {p.description && <p className="text-sm text-muted">{p.description}</p>}
                    </div>
                    <div className="flex flex-col items-start gap-2 sm:items-end">
                      <Latest doc={latest} />
                      {open && (
                        <FormDialog
                          action={submitFamilyDocument}
                          trigger={latest ? "Renvoyer la pièce" : "Envoyer la pièce"}
                          triggerVariant={latest ? "secondary" : "primary"}
                          triggerSize="sm"
                          title={p.label}
                          description={`Pour ${current.student.firstName} ${current.student.lastName}, ${current.classroom.name}.`}
                          submitLabel="Envoyer"
                          pendingLabel="Envoi…"
                        >
                          <input type="hidden" name="kind" value="ENROLLMENT" />
                          <input type="hidden" name="studentId" value={current.student.id} />
                          <input type="hidden" name="requiredPieceId" value={p.id} />
                          <PieceFileField />
                          <FormField label="Un mot pour l'école" name="note" hint="Facultatif.">
                            <Textarea rows={2} maxLength={500} />
                          </FormField>
                        </FormDialog>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarX2 className="size-5 text-primary" aria-hidden /> Absences
          </CardTitle>
          <p className="text-sm text-muted">{toJustify.length ? `${toJustify.length} absence${toJustify.length > 1 ? "s" : ""} à justifier.` : "Aucune absence à justifier."}</p>
        </CardHeader>
        <CardBody>
          {file.absences.length === 0 ? (
            <p className="text-sm text-muted">{child} n&apos;a aucune absence cette année.</p>
          ) : (
            <ul className="divide-y divide-border">
              {file.absences.map((a) => {
                const latest = a.docs[0];
                const open = canSend && a.status === "ABSENT" && canSendAgain(a.docs);
                const when = `${formatDate(a.date)}, ${a.half === "MORNING" ? "matin" : "après-midi"}`;
                return (
                  <li key={a.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold">{when.charAt(0).toUpperCase() + when.slice(1)}</p>
                      {a.status === "EXCUSED" ? <p className="text-sm text-success">Absence excusée{a.reason ? ` : ${a.reason}` : ""}</p> : <p className="text-sm text-muted">Absence non justifiée</p>}
                    </div>
                    <div className="flex flex-col items-start gap-2 sm:items-end">
                      {latest && <Latest doc={latest} />}
                      {open && (
                        <FormDialog
                          action={submitFamilyDocument}
                          trigger="Justifier"
                          triggerVariant={latest ? "secondary" : "primary"}
                          triggerSize="sm"
                          title={`Justifier l'absence du ${when}`}
                          description={`${current.student.firstName} ${current.student.lastName}, ${current.classroom.name}.`}
                          submitLabel="Envoyer la justification"
                          pendingLabel="Envoi…"
                        >
                          <input type="hidden" name="kind" value="ABSENCE" />
                          <input type="hidden" name="studentId" value={current.student.id} />
                          <input type="hidden" name="attendanceId" value={a.id} />
                          <FormField label="Motif de l'absence" name="note" hint="Par exemple : malade, rendez-vous à l'hôpital, décès dans la famille.">
                            <Textarea rows={3} maxLength={500} />
                          </FormField>
                          <PieceFileField label="Justificatif" required={false} hint="Facultatif : un mot signé, une ordonnance, une convocation. PDF ou photo, 3 Mo au plus." />
                        </FormDialog>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      {isParent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HeartPulse className="size-5 text-primary" aria-hidden /> Certificat médical et dispense d&apos;EPS
              <InfoTip label="À propos des certificats médicaux">
                Seuls le chef d&apos;établissement et les personnes qu&apos;il désigne ouvrent le certificat. Dès leur réponse, le fichier est supprimé : l&apos;école garde seulement la dispense et ses dates. Le professeur d&apos;EPS voit la dispense, jamais le certificat.
              </InfoTip>
            </CardTitle>
            <FormDialog
              action={submitFamilyDocument}
              trigger="Envoyer un certificat médical"
              triggerVariant="secondary"
              triggerSize="sm"
              title="Certificat médical pour une dispense d'EPS"
              description={`${current.student.firstName} ${current.student.lastName}, ${current.classroom.name}.`}
              submitLabel="Envoyer le certificat"
              pendingLabel="Envoi…"
            >
              <input type="hidden" name="kind" value="MEDICAL" />
              <input type="hidden" name="studentId" value={current.student.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Dispensé à partir du" name="startsOn" required>
                  <Input type="date" defaultValue={today} />
                </FormField>
                <FormField label="Jusqu'au" name="endsOn" required hint="Jour compris.">
                  <Input type="date" />
                </FormField>
              </div>
              <PieceFileField label="Certificat médical" hint="PDF ou photo du certificat signé par le médecin, 3 Mo au plus." />
              <p className="text-sm text-muted">N&apos;écrivez pas la maladie : le certificat suffit.</p>
            </FormDialog>
          </CardHeader>
          <CardBody>
            {file.medical.length === 0 ? (
              <p className="text-sm text-muted">Aucun certificat envoyé pour {child}.</p>
            ) : (
              <ul className="divide-y divide-border">
                {file.medical.map((m) => (
                  <li key={m.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
                    <p className="font-semibold">{m.startsOn && m.endsOn ? `Dispense d'EPS du ${formatDate(m.startsOn)} au ${formatDate(m.endsOn)}` : "Dispense d'EPS"}</p>
                    <Latest doc={m} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
