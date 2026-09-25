import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/kit/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { DecisionForm } from "@/features/requests/components/decision-form";
import { REQUEST_STATUS_LABELS, REQUEST_STATUS_TONES, REQUEST_TYPE_LABELS } from "@/features/requests/labels";
import { getRequest } from "@/features/requests/queries";
import { can, requirePermission } from "@/lib/auth/authorize";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Demande" };

// A request outside the user's scope is reported as not found: the scoped
// query simply does not return it.
export default async function RequestPage({ params }: PageProps<"/espace/demandes/[id]">) {
  const user = await requirePermission("request:view");
  const { id } = await params;
  const request = id.length <= 64 ? await getRequest(user, id) : null;
  if (!request) notFound();
  const canDecide = can(user, "request:approve") && request.status === "PENDING" && ["NATIONAL", "DEPARTMENT", "COMMUNE"].includes(user.scope.level);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={request.subject}
        description={`${REQUEST_TYPE_LABELS[request.type]} · ${request.school.name} (${request.school.code}), ${request.school.commune.name}, ${request.school.commune.department.name}`}
        actions={
          <ButtonLink href="/espace/demandes" variant="secondary">
            <ArrowLeft aria-hidden /> Toutes les demandes
          </ButtonLink>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Demande</CardTitle>
            <Badge tone={REQUEST_STATUS_TONES[request.status]}>{REQUEST_STATUS_LABELS[request.status]}</Badge>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-muted">
              Déposée le {formatDateTime(request.createdAt)} par {request.author.firstName} {request.author.lastName}
            </p>
            <p className="mt-3 whitespace-pre-line">{request.body}</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Décision</CardTitle>
          </CardHeader>
          <CardBody>
            {request.status !== "PENDING" ? (
              <Alert tone={request.status === "APPROVED" ? "success" : "danger"} title={`${REQUEST_STATUS_LABELS[request.status]} le ${request.decidedAt ? formatDateTime(request.decidedAt) : ""}`}>
                <p className="mt-1 whitespace-pre-line">{request.decisionNote}</p>
                {request.decider && (
                  <p className="mt-2 text-xs">
                    Par {request.decider.firstName} {request.decider.lastName}, {request.decider.role.name}
                  </p>
                )}
              </Alert>
            ) : canDecide ? (
              <DecisionForm id={request.id} />
            ) : (
              <p className="text-sm text-muted">En attente d&apos;examen par la circonscription, la direction départementale ou le ministère.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
