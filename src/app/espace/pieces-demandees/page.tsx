import { FilePlus2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DataTable, type Column } from "@/components/kit/data-table";
import { FormDialog } from "@/components/kit/form-dialog";
import { FormField } from "@/components/kit/form-field";
import { PageHeader } from "@/components/kit/page-header";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { SchoolPicker } from "@/features/calendar/components/school-picker";
import { isoInDays } from "@/features/calendar/rules";
import { createDocRequests } from "@/features/document-requests/actions";
import { DOC_STATUS_LABELS, DOC_STATUS_TONES, DOC_STATUSES, isOverdue } from "@/features/document-requests/labels";
import { docFilters, listDocRequests, requestableSchools } from "@/features/document-requests/queries";
import { can, requirePermission } from "@/lib/auth/authorize";
import { listParams } from "@/lib/list";
import { cn, formatDate, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Pièces demandées" };

type Row = Awaited<ReturnType<typeof listDocRequests>>["rows"][number];

export default async function DocRequestsPage({ searchParams }: PageProps<"/espace/pieces-demandees">) {
  const user = await requirePermission("document_request:view");
  const sp = await searchParams;
  const filters = docFilters(sp);
  const page = listParams(sp);
  const isSchool = user.scope.level === "SCHOOL";
  const canAsk = can(user, "document_request:create") && ["NATIONAL", "DEPARTMENT", "COMMUNE"].includes(user.scope.level);
  const [{ rows, total, byStatus }, schools] = await Promise.all([listDocRequests(user, filters, page), canAsk ? requestableSchools(user) : Promise.resolve([])]);
  const now = new Date();

  const columns: Column<Row>[] = [
    {
      header: "Demande",
      primary: true,
      cell: (r) => (
        <div>
          <Link href={`/espace/pieces-demandees/${r.id}`} className="font-semibold text-primary hover:underline">
            {r.title}
          </Link>
          {r.requester && <p className="text-xs text-muted">Par {r.requester.name}, {r.requester.role}</p>}
        </div>
      ),
    },
    ...(isSchool ? [] : [{ header: "Établissement", cell: (r: Row) => `${r.school.name} (${r.school.commune.name})`, hideBelow: "md" as const }]),
    {
      header: "Échéance",
      cell: (r) =>
        r.dueDate ? (
          <span className="flex flex-wrap items-center gap-1.5">
            {formatDate(r.dueDate)}
            {isOverdue(r, now) && <Badge tone="danger">En retard</Badge>}
          </span>
        ) : (
          <span className="text-muted">Sans date limite</span>
        ),
    },
    { header: "Fichiers", className: "text-right tabular-nums", cell: (r) => formatNumber(r._count.files), hideBelow: "sm" },
    { header: "Statut", cell: (r) => <Badge tone={DOC_STATUS_TONES[r.status]}>{DOC_STATUS_LABELS[r.status]}</Badge> },
  ];

  const tabs = [{ value: null, label: "Toutes", count: Object.values(byStatus).reduce((a, b) => a + b, 0) }, ...DOC_STATUSES.map((s) => ({ value: s, label: DOC_STATUS_LABELS[s], count: byStatus[s] }))];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Pièces demandées"
        description={
          isSchool
            ? "Documents que la tutelle demande à votre établissement. Ajoutez les fichiers puis transmettez."
            : "Documents demandés aux établissements de votre périmètre : suivez les réponses et les échéances."
        }
        actions={
          canAsk ? (
            <FormDialog
              action={createDocRequests}
              trigger={
                <>
                  <FilePlus2 aria-hidden /> Demander des pièces
                </>
              }
              title="Demander des pièces"
              description="Chaque établissement choisi reçoit la demande et vous transmet ses fichiers."
              submitLabel="Envoyer la demande"
              wide
            >
              <FormField label="Titre" name="title" required hint="Par exemple : Rapport de rentrée 2026-2027.">
                <Input maxLength={150} autoComplete="off" />
              </FormField>
              <FormField label="Pièces attendues" name="description" required>
                <Textarea rows={4} maxLength={2000} />
              </FormField>
              <FormField label="Date limite" name="dueDate" hint="Facultative.">
                <Input type="date" defaultValue={isoInDays(21)} />
              </FormField>
              <SchoolPicker schools={schools.map((s) => ({ id: s.id, name: s.name, code: s.code, commune: s.commune.name }))} legend="Établissements destinataires" />
            </FormDialog>
          ) : null
        }
      />
      <nav aria-label="Filtrer par statut" className="relative -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {tabs.map((t) => {
          const current = filters.status === t.value;
          return (
            <Link
              key={t.label}
              href={t.value ? `/espace/pieces-demandees?statut=${t.value}` : "/espace/pieces-demandees"}
              aria-current={current ? "page" : undefined}
              className={cn("inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 text-sm font-semibold whitespace-nowrap sm:min-h-9", current ? "border-primary bg-primary text-on-primary" : "border-border-strong hover:bg-surface-2")}
            >
              {t.label} <span className="ml-1 tabular-nums opacity-80">({formatNumber(t.count)})</span>
            </Link>
          );
        })}
      </nav>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        total={total}
        page={page.page}
        pageSize={page.pageSize}
        searchParams={sp}
        basePath="/espace/pieces-demandees"
        searchPlaceholder={isSchool ? "Rechercher par titre…" : "Rechercher par titre ou établissement…"}
        caption="Pièces demandées"
        emptyTitle="Aucune demande de pièces"
        emptyDescription={isSchool ? "La tutelle n'a rien demandé à votre établissement." : "Aucune demande dans votre périmètre."}
      />
    </div>
  );
}
