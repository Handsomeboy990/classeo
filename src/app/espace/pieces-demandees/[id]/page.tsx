import { ArrowLeft, Download, FileText, Send, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ConfirmButton } from "@/components/kit/confirm-button";
import { PageHeader } from "@/components/kit/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { removeDocFile, submitDocRequest } from "@/features/document-requests/actions";
import { ReviewDocForm, UploadDocForm } from "@/features/document-requests/components/forms";
import { DOC_STATUS_LABELS, DOC_STATUS_TONES, isOverdue, MAX_FILES_PER_REQUEST, schoolCanAnswer } from "@/features/document-requests/labels";
import { getDocRequest } from "@/features/document-requests/queries";
import { can, requirePermission } from "@/lib/auth/authorize";
import { fileUrl } from "@/lib/files";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Pièces demandées" };

function size(bytes: number) {
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1).replace(".", ",")} Mo` : `${Math.max(1, Math.round(bytes / 1000))} Ko`;
}

// A request outside the user's scope is reported as not found.
export default async function DocRequestPage({ params }: PageProps<"/espace/pieces-demandees/[id]">) {
  const user = await requirePermission("document_request:view");
  const { id } = await params;
  const request = id.length <= 64 ? await getDocRequest(user, id) : null;
  if (!request) notFound();

  const now = new Date();
  const ownSchool = user.scope.level === "SCHOOL" && user.scope.schoolId === request.school.id;
  const canAnswer = ownSchool && can(user, "document_request:update") && schoolCanAnswer(request.status);
  const canReview =
    can(user, "document_request:approve") && ["NATIONAL", "DEPARTMENT", "COMMUNE"].includes(user.scope.level) && (request.requestedById === user.id || user.scope.level === "NATIONAL");
  const requester = request.names.get(request.requestedById);
  const reviewer = request.reviewedById ? request.names.get(request.reviewedById) : null;

  const review =
    request.status === "ACCEPTED" || request.status === "REJECTED" ? (
      <Alert tone={request.status === "ACCEPTED" ? "success" : "warning"} title={`${request.status === "ACCEPTED" ? "Acceptée" : "Renvoyée à l'établissement"}${request.reviewedAt ? ` le ${formatDateTime(request.reviewedAt)}` : ""}`}>
        {request.responseNote && <p className="mt-1 whitespace-pre-line">{request.responseNote}</p>}
        {reviewer && <p className="mt-2 text-xs">Par {reviewer.name}, {reviewer.role}</p>}
      </Alert>
    ) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={request.title}
        description={`${request.school.name} (${request.school.code}), ${request.school.commune.name}, ${request.school.commune.department.name}`}
        actions={
          <ButtonLink href="/espace/pieces-demandees" variant="secondary" className="max-lg:hidden">
            <ArrowLeft aria-hidden /> Toutes les demandes
          </ButtonLink>
        }
      />
      {isOverdue(request, now) && (
        <Alert tone="danger" title="Échéance dépassée">
          Les pièces étaient attendues pour le {formatDate(request.dueDate!)}.
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-4 *:min-w-0 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Pièces attendues</CardTitle>
            <Badge tone={DOC_STATUS_TONES[request.status]}>{DOC_STATUS_LABELS[request.status]}</Badge>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              Demandée le {formatDateTime(request.createdAt)}
              {requester ? ` par ${requester.name}, ${requester.role}` : ""}
              {request.dueDate ? ` · à fournir avant le ${formatDate(request.dueDate)}` : " · sans date limite"}
            </p>
            <p className="whitespace-pre-line">{request.description}</p>

            <section aria-labelledby="files-title" className="flex flex-col gap-3">
              <h2 id="files-title" className="text-base font-bold">
                Fichiers ({request.files.length}/{MAX_FILES_PER_REQUEST})
              </h2>
              {request.files.length === 0 ? (
                <p className="text-sm text-muted">{ownSchool ? "Aucun fichier ajouté pour l'instant." : "L'établissement n'a encore transmis aucun fichier."}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {request.files.map((f) => (
                    <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-border px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="size-5 shrink-0 text-muted" aria-hidden />
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{f.file.fileName}</p>
                          <p className="text-xs text-muted">
                            {size(f.file.size)} · ajouté le {formatDateTime(f.createdAt)}
                            {request.names.get(f.uploadedById) ? ` par ${request.names.get(f.uploadedById)!.name}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <ButtonLink href={fileUrl(f.file.id)!} variant="secondary" size="sm" prefetch={false} aria-label={`Télécharger ${f.file.fileName}`}>
                          <Download aria-hidden /> Télécharger
                        </ButtonLink>
                        {canAnswer && (
                          <ConfirmButton
                            action={removeDocFile}
                            fields={{ requestId: request.id, fileId: f.file.id }}
                            variant="danger-ghost"
                            size="icon-sm"
                            label={`Retirer ${f.file.fileName}`}
                            title="Retirer ce fichier ?"
                            description={`${f.file.fileName} sera supprimé de la demande.`}
                            confirmLabel="Retirer"
                          >
                            <Trash2 aria-hidden />
                          </ConfirmButton>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {canAnswer && request.files.length < MAX_FILES_PER_REQUEST && <UploadDocForm requestId={request.id} />}
            </section>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{ownSchool ? "Réponse" : "Examen"}</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            {request.status === "REJECTED" && review}
            {canAnswer ? (
              <>
                <p className="text-sm text-muted">Quand toutes les pièces sont ajoutées, transmettez-les : l&apos;auteur de la demande est prévenu.</p>
                {request.files.length > 0 ? (
                  <ConfirmButton
                    action={submitDocRequest}
                    fields={{ requestId: request.id }}
                    tone="primary"
                    variant="primary"
                    title="Transmettre les pièces ?"
                    description={`${request.files.length} fichier${request.files.length > 1 ? "s" : ""} seront transmis. Vous ne pourrez plus les modifier, sauf si la demande vous est renvoyée.`}
                    confirmLabel="Transmettre"
                  >
                    <Send aria-hidden /> Transmettre les pièces
                  </ConfirmButton>
                ) : (
                  <p className="text-sm font-semibold">Ajoutez au moins un fichier pour pouvoir transmettre.</p>
                )}
              </>
            ) : canReview && request.status === "SUBMITTED" ? (
              <ReviewDocForm requestId={request.id} decided={null} />
            ) : request.status === "ACCEPTED" ? (
              review
            ) : request.status === "SUBMITTED" ? (
              <p className="text-sm text-muted">Pièces transmises, en attente d&apos;examen par l&apos;auteur de la demande.</p>
            ) : request.status === "PENDING" ? (
              <p className="text-sm text-muted">En attente des pièces de l&apos;établissement.</p>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
