import { Check, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ConfirmButton } from "@/components/kit/confirm-button";
import { DataTable, type Column } from "@/components/kit/data-table";
import { FormDialog } from "@/components/kit/form-dialog";
import { FormField } from "@/components/kit/form-field";
import { PageHeader } from "@/components/kit/page-header";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { createSubject, decideSubject, deleteSubject, proposeSubject, renameSubject } from "@/features/subjects/actions";
import { SUBJECT_STATUS_LABELS, SUBJECT_STATUS_TONES, SUBJECT_STATUSES } from "@/features/subjects/labels";
import { listSubjects, subjectFilters } from "@/features/subjects/queries";
import { can, requirePermission } from "@/lib/auth/authorize";
import { listParams } from "@/lib/list";
import { cn, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Matières" };

type Row = Awaited<ReturnType<typeof listSubjects>>["rows"][number];

const TAB_LABELS = { APPROVED: "Catalogue", PENDING: "Propositions en attente", REJECTED: "Propositions refusées" } as const;

function SubjectFields() {
  return (
    <>
      <FormField label="Nom de la matière" name="name" required>
        <Input maxLength={80} autoComplete="off" />
      </FormField>
      <FormField label="Code" name="code" required hint="Court et en majuscules, par exemple INFO ou P-EC.">
        <Input maxLength={17} autoComplete="off" className="uppercase" />
      </FormField>
    </>
  );
}

export default async function SubjectsPage({ searchParams }: PageProps<"/espace/matieres">) {
  const user = await requirePermission("subject:view");
  const sp = await searchParams;
  const filters = subjectFilters(sp);
  const page = listParams(sp, 30);
  const { rows, total, byStatus } = await listSubjects(user, filters, page);
  const ministry = user.scope.level === "NATIONAL";
  const isSchool = user.scope.level === "SCHOOL";
  const canCreate = ministry && can(user, "subject:create");
  const canRename = ministry && can(user, "subject:update");
  const canDelete = ministry && can(user, "subject:delete");
  const canDecide = ministry && can(user, "subject:approve");
  const canPropose = isSchool && can(user, "request:create");

  const columns: Column<Row>[] = [
    { header: "Code", cell: (s) => <span className="font-mono text-sm font-semibold">{s.code}</span> },
    { header: "Matière", primary: true, cell: (s) => <span className="font-semibold">{s.name}</span> },
    ...(filters.status === "APPROVED"
      ? [{ header: "Classes", className: "text-right tabular-nums", cell: (s: Row) => formatNumber(s._count.assignments), hideBelow: "sm" as const }]
      : [
          { header: "Proposée par", cell: (s: Row) => (s.requestedBySchool ? `${s.requestedBySchool.name} (${s.requestedBySchool.commune.name})` : "Ministère"), hideBelow: "md" as const },
          { header: "Statut", cell: (s: Row) => <Badge tone={SUBJECT_STATUS_TONES[s.status]}>{SUBJECT_STATUS_LABELS[s.status]}</Badge> },
          ...(filters.status === "REJECTED" ? [{ header: "Motif du refus", cell: (s: Row) => s.decisionNote ?? "–", hideBelow: "lg" as const, mobileHidden: false }] : []),
        ]),
  ];

  const rowActions = (s: Row) => (
    <div className="flex flex-wrap justify-end gap-2">
      {s.status === "APPROVED" && canRename && (
        <FormDialog action={renameSubject} trigger={<Pencil aria-hidden />} triggerVariant="ghost" triggerSize="icon-sm" triggerLabel={`Renommer ${s.name}`} title={`Renommer ${s.name}`} description={`Le code ${s.code} ne change pas.`}>
          <input type="hidden" name="id" value={s.id} />
          <FormField label="Nouveau nom" name="name" required>
            <Input defaultValue={s.name} maxLength={80} />
          </FormField>
        </FormDialog>
      )}
      {s.status === "APPROVED" && canDelete && s._count.assignments === 0 && (
        <ConfirmButton action={deleteSubject} fields={{ id: s.id }} variant="danger-ghost" size="icon-sm" label={`Supprimer ${s.name}`} title={`Supprimer ${s.name} ?`} description="La matière n'est enseignée dans aucune classe. Elle disparaît du catalogue national." confirmLabel="Supprimer">
          <Trash2 aria-hidden />
        </ConfirmButton>
      )}
      {s.status === "PENDING" && canDecide && (
        <>
          <ConfirmButton
            action={decideSubject}
            fields={{ id: s.id, decision: "APPROVED" }}
            tone="primary"
            variant="soft"
            size="sm"
            label={`Accepter ${s.name}`}
            title={`Accepter ${s.name} au catalogue ?`}
            description="La matière devient disponible pour tous les établissements. L'établissement qui l'a proposée est prévenu."
            confirmLabel="Accepter"
          >
            <Check aria-hidden /> Accepter
          </ConfirmButton>
          <FormDialog action={decideSubject} trigger={<><X aria-hidden /> Refuser</>} triggerVariant="danger-ghost" triggerSize="sm" triggerLabel={`Refuser ${s.name}`} title={`Refuser ${s.name}`} submitLabel="Refuser la proposition">
            <input type="hidden" name="id" value={s.id} />
            <input type="hidden" name="decision" value="REJECTED" />
            <FormField label="Motif du refus" name="note" required hint="Il est transmis à l'établissement.">
              <Textarea rows={3} maxLength={500} />
            </FormField>
          </FormDialog>
        </>
      )}
    </div>
  );
  const withActions = (filters.status === "APPROVED" && (canRename || canDelete)) || (filters.status === "PENDING" && canDecide);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Matières"
        description={
          ministry
            ? "Catalogue national des matières. Les établissements proposent de nouvelles matières, que vous acceptez ou refusez."
            : "Catalogue national fixé par le ministère. Seules les matières du catalogue peuvent être attribuées aux classes."
        }
        actions={
          <>
            {canCreate && (
              <FormDialog action={createSubject} trigger={<><Plus aria-hidden /> Nouvelle matière</>} title="Nouvelle matière au catalogue" description="Elle est aussitôt disponible pour tous les établissements." submitLabel="Ajouter au catalogue">
                <SubjectFields />
              </FormDialog>
            )}
            {canPropose && (
              <FormDialog action={proposeSubject} trigger={<><Send aria-hidden /> Proposer une matière</>} title="Proposer une matière" description="Le ministère examine la proposition. Une fois acceptée, elle est disponible pour tous les établissements." submitLabel="Envoyer la proposition">
                <SubjectFields />
              </FormDialog>
            )}
          </>
        }
      />
      <nav aria-label="Filtrer les matières" className="relative -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {SUBJECT_STATUSES.map((s) => {
          const current = filters.status === s;
          return (
            <Link
              key={s}
              href={s === "APPROVED" ? "/espace/matieres" : `/espace/matieres?statut=${s}`}
              aria-current={current ? "page" : undefined}
              className={cn("inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 text-sm font-semibold whitespace-nowrap sm:min-h-9", current ? "border-primary bg-primary text-on-primary" : "border-border-strong hover:bg-surface-2")}
            >
              {TAB_LABELS[s]} <span className="ml-1 tabular-nums opacity-80">({formatNumber(byStatus[s])})</span>
            </Link>
          );
        })}
      </nav>
      <DataTable
        rows={rows}
        columns={withActions ? [...columns, { header: "Actions", actions: true, className: "text-right", cell: rowActions }] : columns}
        rowKey={(s) => s.id}
        total={total}
        page={page.page}
        pageSize={page.pageSize}
        searchParams={sp}
        basePath="/espace/matieres"
        searchPlaceholder="Rechercher par nom ou code…"
        caption={TAB_LABELS[filters.status]}
        emptyTitle={filters.status === "APPROVED" ? "Aucune matière" : "Aucune proposition"}
        emptyDescription={filters.status === "PENDING" ? (isSchool ? "Votre établissement n'a aucune proposition en attente." : "Aucune proposition n'attend de décision.") : undefined}
      />
    </div>
  );
}
