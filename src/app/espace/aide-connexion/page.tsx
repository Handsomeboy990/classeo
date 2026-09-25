import type { Metadata } from "next";

import { DataTable, type Column } from "@/components/kit/data-table";
import { PageHeader } from "@/components/kit/page-header";
import { UrlSelect } from "@/components/kit/url-select";
import { Badge } from "@/components/ui/badge";
import { HelpRequestActions } from "@/features/password-help/components/help-actions";
import { listHelpRequests, type HelpStatusFilter } from "@/features/password-help/queries";
import { requirePermission } from "@/lib/auth/authorize";
import { listParams, param } from "@/lib/list";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Demandes de réinitialisation" };

type Row = Awaited<ReturnType<typeof listHelpRequests>>["rows"][number];

const STATUS: Record<string, { label: string; tone: "warning" | "success" | "neutral" }> = {
  PENDING: { label: "En attente", tone: "warning" },
  RESOLVED: { label: "Mot de passe remis", tone: "success" },
  REJECTED: { label: "Refusée", tone: "neutral" },
};

const FILTERS: Record<string, HelpStatusFilter> = { "en-attente": "PENDING", traitees: "RESOLVED", refusees: "REJECTED" };

export default async function PasswordHelpPage({ searchParams }: PageProps<"/espace/aide-connexion">) {
  const user = await requirePermission("user:update");
  const sp = await searchParams;
  const page = listParams(sp);
  const statut = param(sp, "statut") ?? "";
  const { rows, total } = await listHelpRequests(user, FILTERS[statut] ?? null, page);

  const columns: Column<Row>[] = [
    {
      header: "Personne",
      primary: true,
      cell: (r) => (
        <div>
          <p className="font-semibold">
            {r.user.firstName} {r.user.lastName}
          </p>
          <p className="font-mono text-xs break-all text-muted">{r.user.username}</p>
          <p className="text-xs text-muted">
            {r.user.role.name}
            {r.user.school ? `, ${r.user.school.name}` : r.user.commune ? `, ${r.user.commune.name}` : r.user.department ? `, ${r.user.department.name}` : ""}
          </p>
        </div>
      ),
    },
    { header: "Demandée le", cell: (r) => formatDateTime(r.createdAt), hideBelow: "md" },
    {
      header: "Rappeler au",
      cell: (r) => {
        const phone = r.contact ?? r.user.phone;
        return phone ? (
          <a href={`tel:${phone.replace(/\s+/g, "")}`} className="font-mono hover:underline">
            {phone}
          </a>
        ) : (
          <span className="text-muted">Aucun numéro</span>
        );
      },
    },
    {
      header: "Statut",
      cell: (r) => (
        <div className="flex flex-col items-start gap-1">
          <Badge tone={STATUS[r.status]!.tone} dot>
            {STATUS[r.status]!.label}
          </Badge>
          {!r.user.isActive && <Badge tone="danger">Compte désactivé</Badge>}
          {r.handledAt && (
            <span className="text-xs text-muted">
              {formatDateTime(r.handledAt)}
              {r.handler ? `, ${r.handler.firstName} ${r.handler.lastName}` : ""}
            </span>
          )}
          {r.note && <span className="text-xs text-muted">Motif : {r.note}</span>}
        </div>
      ),
    },
    {
      header: "Actions",
      actions: true,
      className: "text-right",
      cell: (r) => (
        <HelpRequestActions
          id={r.id}
          name={`${r.user.firstName} ${r.user.lastName}`}
          contact={r.contact ?? r.user.phone}
          handled={r.status === "PENDING" ? undefined : <span className="text-xs text-muted">Traitée</span>}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Demandes de réinitialisation"
        description="Mots de passe oubliés des comptes que vous gérez : élèves, parents et personnel pour un établissement, chefs d'établissement pour une circonscription, et ainsi de suite. Vérifiez l'identité de la personne avant de lui remettre un mot de passe temporaire."
      />
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        total={total}
        page={page.page}
        pageSize={page.pageSize}
        searchParams={sp}
        basePath="/espace/aide-connexion"
        searchPlaceholder={false}
        toolbar={
          <UrlSelect
            param="statut"
            label="Statut"
            hideLabel
            value={statut}
            allLabel="Toutes les demandes"
            options={[
              { value: "en-attente", label: "En attente" },
              { value: "traitees", label: "Mot de passe remis" },
              { value: "refusees", label: "Refusées" },
            ]}
            className="sm:w-56"
          />
        }
        caption="Demandes de réinitialisation de mot de passe"
        emptyTitle="Aucune demande"
        emptyDescription="Personne de votre périmètre n'a demandé de nouveau mot de passe."
      />
    </div>
  );
}
