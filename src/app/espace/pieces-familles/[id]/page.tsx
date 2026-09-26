import { ArrowLeft, Download, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/kit/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { ReviewForm } from "@/features/family-documents/components/forms";
import { staffDoc } from "@/features/family-documents/queries";
import { KIND_LABELS, STATUS_LABELS, STATUS_TONES } from "@/features/family-documents/rules";
import { requirePermission } from "@/lib/auth/authorize";
import { fileUrl, sizeLabel } from "@/lib/files";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Pièce d'une famille" };

// A piece outside the user's school or rights is reported as not found.
export default async function FamilyPiecePage({ params }: PageProps<"/espace/pieces-familles/[id]">) {
  const user = await requirePermission(["family_document:approve", "health_document:approve"]);
  const { id } = await params;
  const doc = await staffDoc(user, id);
  if (!doc) notFound();

  const title = doc.kind === "ENROLLMENT" ? (doc.requiredPiece?.label ?? KIND_LABELS.ENROLLMENT) : KIND_LABELS[doc.kind];
  const image = doc.file && doc.file.mimeType.startsWith("image/");
  const facts: [string, string][] = [
    ["Élève", `${doc.student.firstName} ${doc.student.lastName} (${doc.student.matricule}), ${doc.enrollment.classroom.name}`],
    ["Envoyée par", `${doc.submittedBy.firstName} ${doc.submittedBy.lastName}, ${doc.submittedBy.role.name}, le ${formatDateTime(doc.createdAt)}`],
    ...(doc.attendance ? [["Absence", `${formatDate(doc.attendance.date)}, ${doc.attendance.half === "MORNING" ? "matin" : "après-midi"}`] as [string, string]] : []),
    ...(doc.startsOn && doc.endsOn ? [["Dispense d'EPS", `Du ${formatDate(doc.startsOn)} au ${formatDate(doc.endsOn)}, jours compris`] as [string, string]] : []),
    ...(doc.note ? [["Mot de la famille", doc.note] as [string, string]] : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        description={`${doc.student.firstName} ${doc.student.lastName}, ${doc.enrollment.classroom.name}`}
        actions={
          <ButtonLink href="/espace/pieces-familles" variant="secondary" className="max-lg:hidden">
            <ArrowLeft aria-hidden /> Toutes les pièces
          </ButtonLink>
        }
      />
      <div className="grid grid-cols-1 gap-4 *:min-w-0 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{KIND_LABELS[doc.kind]}</CardTitle>
            <Badge tone={STATUS_TONES[doc.status]}>{STATUS_LABELS[doc.status]}</Badge>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[12rem_1fr]">
              {facts.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-sm font-semibold text-muted">{k}</dt>
                  <dd className="whitespace-pre-line">{v}</dd>
                </div>
              ))}
            </dl>
            {doc.fileId && doc.file ? (
              <section aria-labelledby="file-title" className="flex flex-col gap-3">
                <h2 id="file-title" className="text-base font-bold">
                  Fichier
                </h2>
                {image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fileUrl(doc.fileId)!} alt={`${title}, envoyée pour ${doc.student.firstName} ${doc.student.lastName}`} className="max-h-[32rem] w-auto max-w-full rounded-control border border-border object-contain" />
                )}
                <p className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-muted">
                    {doc.file.fileName}, {sizeLabel(doc.file.size)}
                  </span>
                  <ButtonLink href={fileUrl(doc.fileId)!} variant="secondary" size="sm" prefetch={false} target="_blank" rel="noopener">
                    <Download aria-hidden /> {image ? "Ouvrir en grand" : "Ouvrir le fichier"}
                  </ButtonLink>
                </p>
              </section>
            ) : doc.fileRemovedAt ? (
              <Alert tone="info" title="Fichier supprimé">
                Pièce de santé : le fichier a été supprimé le {formatDateTime(doc.fileRemovedAt)}, après la décision. Seules la décision et les dates restent.
              </Alert>
            ) : (
              <p className="text-sm text-muted">Aucun fichier joint : la famille a expliqué l&apos;absence par écrit.</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" aria-hidden /> Décision
            </CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            {doc.status === "PENDING" ? (
              <>
                {doc.kind === "ABSENCE" && <p className="text-sm text-muted">Valider marque l&apos;absence comme excusée dans le registre.</p>}
                <ReviewForm documentId={doc.id} health={doc.health} />
              </>
            ) : (
              <Alert tone={doc.status === "ACCEPTED" ? "success" : "warning"} title={`${doc.status === "ACCEPTED" ? "Validée" : "Refusée"}${doc.reviewedAt ? ` le ${formatDateTime(doc.reviewedAt)}` : ""}`}>
                {doc.reviewNote && <p className="mt-1 whitespace-pre-line">{doc.reviewNote}</p>}
                {doc.reviewedBy && (
                  <p className="mt-2 text-xs">
                    Par {doc.reviewedBy.firstName} {doc.reviewedBy.lastName}
                  </p>
                )}
              </Alert>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
