import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DataTable, type Column } from "@/components/kit/data-table";
import { PageHeader } from "@/components/kit/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { examFilters, listExams, pendingForUser } from "@/features/mock-exams/queries";
import { EXAM_STATUSES, ORGANIZER_LABELS, STATUS_LABELS, STATUS_TONES } from "@/features/mock-exams/rules";
import { can, requirePermission } from "@/lib/auth/authorize";
import { isTeacherRole } from "@/lib/auth/scope";
import { listParams } from "@/lib/list";
import { cn, formatDate, formatNumber, plural } from "@/lib/utils";

export const metadata: Metadata = { title: "Examens blancs" };

type Row = Awaited<ReturnType<typeof listExams>>["rows"][number];

export default async function MockExamsPage({ searchParams }: PageProps<"/espace/examens-blancs">) {
  const user = await requirePermission("mock_exam:view");
  const sp = await searchParams;
  const filters = examFilters(sp);
  const page = listParams(sp);
  const [{ rows, total, byStatus }, pending] = await Promise.all([listExams(user, filters, page), pendingForUser(user)]);
  const family = user.scope.level === "SELF";
  const canCreate = can(user, "mock_exam:create") && !family && !isTeacherRole(user);
  const isSchool = user.scope.level === "SCHOOL";

  const columns: Column<Row>[] = [
    {
      header: "Examen",
      primary: true,
      cell: (r) => (
        <div>
          <Link href={`/espace/examens-blancs/${r.id}`} className="font-semibold text-primary hover:underline">
            {r.title}
          </Link>
          <p className="text-xs text-muted">
            {r.levelName} · {plural(r.subjects.length, "matière")}
          </p>
        </div>
      ),
    },
    { header: "Organisateur", cell: (r) => <span title={ORGANIZER_LABELS[r.organizerLevel]}>{r.organizerName}</span>, hideBelow: "md" },
    { header: "Épreuves", cell: (r) => (r.startDate.getTime() === r.endDate.getTime() ? formatDate(r.startDate) : `du ${formatDate(r.startDate)} au ${formatDate(r.endDate)}`), hideBelow: "sm" },
    ...(family ? [] : [{ header: "Établissements", cell: (r: Row) => formatNumber(r._count.participants), hideBelow: "lg" as const }]),
    { header: "Statut", cell: (r) => <Badge tone={STATUS_TONES[r.status]}>{STATUS_LABELS[r.status]}</Badge> },
  ];

  const tabs = [
    { value: null, label: "Tous", count: Object.values(byStatus).reduce((a, b) => a + (b ?? 0), 0) },
    ...EXAM_STATUSES.filter((s) => !family || s === "APPROVED" || s === "CLOSED").map((s) => ({ value: s, label: STATUS_LABELS[s], count: byStatus[s] ?? 0 })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Examens blancs"
        info={
          family
            ? "Les examens blancs de vos enfants et leurs résultats."
            : isSchool
              ? "Examens blancs de CM2, de 3e et de Tle organisés par votre établissement, auxquels il est invité ou qui lui sont imposés."
              : "Examens blancs des classes d'examen de votre périmètre : ceux que vous décidez, ceux que les établissements proposent à votre validation."
        }
        actions={
          canCreate ? (
            <ButtonLink href="/espace/examens-blancs/nouveau">
              <Plus aria-hidden /> {isSchool ? "Organiser un examen blanc" : "Décider un examen blanc"}
            </ButtonLink>
          ) : null
        }
      />
      {pending.length > 0 && (
        <Alert tone="warning" title={isSchool ? `${plural(pending.length, "invitation")} en attente de votre réponse` : `${plural(pending.length, "examen")} en attente de votre validation`}>
          <ul className="mt-1 list-disc pl-5">
            {pending.map((p) => (
              <li key={p.id}>
                <Link href={`/espace/examens-blancs/${p.id}`} className="font-semibold underline">
                  {p.title}
                </Link>
                {p.organizerSchool ? `, proposé par ${p.organizerSchool.name}` : ""}, à partir du {formatDate(p.startDate)}
              </li>
            ))}
          </ul>
        </Alert>
      )}
      <nav aria-label="Filtrer par statut" className="relative -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {tabs.map((t) => {
          const current = filters.status === t.value;
          const q = new URLSearchParams();
          if (t.value) q.set("statut", t.value);
          if (filters.q) q.set("q", filters.q);
          return (
            <Link
              key={t.label}
              href={`/espace/examens-blancs${q.size ? `?${q}` : ""}`}
              aria-current={current ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 text-sm font-semibold whitespace-nowrap sm:min-h-9",
                current ? "border-primary bg-primary text-on-primary" : "border-border-strong hover:bg-surface-2",
              )}
            >
              {t.label} <span className="tabular-nums opacity-80">({formatNumber(t.count)})</span>
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
        basePath="/espace/examens-blancs"
        searchPlaceholder="Rechercher par intitulé ou établissement…"
        caption="Examens blancs"
        emptyTitle="Aucun examen blanc"
        emptyDescription={filters.status || filters.q ? "Aucun examen ne correspond à ces critères." : family ? "Aucun examen blanc n'est prévu pour vos enfants." : "Aucun examen blanc n'a encore été organisé."}
      />
    </div>
  );
}
