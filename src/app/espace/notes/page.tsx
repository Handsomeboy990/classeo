import { Download, Lock, PenLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DataTable, type Column } from "@/components/kit/data-table";
import { PageHeader } from "@/components/kit/page-header";
import { EmptyState } from "@/components/kit/states";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getActiveYear, getCurrentPeriod } from "@/features/classes/academic";
import { UrlSelect } from "@/components/kit/url-select";
import { ClassLockButtons, CreateSheetDialog } from "@/features/grades/components/sheet-forms";
import { assignmentsWithoutSheet, listSheets, sheetFilterOptions } from "@/features/grades/queries";
import { can, requirePermission } from "@/lib/auth/authorize";
import { FORMULA_SHORT } from "@/lib/domain/grade-entry";
import { listParams, param } from "@/lib/list";
import { formatPercent } from "@/lib/utils";

export const metadata: Metadata = { title: "Notes" };

type Row = Awaited<ReturnType<typeof listSheets>>["rows"][number];

function Progress({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex min-w-32 items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avancement de la saisie">
        <div className={pct >= 100 ? "h-full rounded-full bg-success" : "h-full rounded-full bg-primary"} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-xs font-semibold tabular-nums">{formatPercent(value)}</span>
    </div>
  );
}

export default async function NotesPage(props: PageProps<"/espace/notes">) {
  const user = await requirePermission("grade:view");
  const sp = await props.searchParams;
  const { q, page, skip, take } = listParams(sp, 30);
  const [year, current] = await Promise.all([getActiveYear(), getCurrentPeriod()]);
  if (!year || !current) return <EmptyState title="Aucune année scolaire active" description="Les fiches de notes apparaîtront dès qu'une année scolaire sera ouverte." />;

  const periodId = year.periods.find((p) => p.id === param(sp, "periode"))?.id ?? current.id;
  const period = year.periods.find((p) => p.id === periodId)!;
  const classes = await sheetFilterOptions(user, year.id);
  const classroomId = classes.find((c) => c.id === param(sp, "classe"))?.id;
  const canCreate = can(user, "grade:create") && !period.isClosed;
  const [{ rows, total }, assignments] = await Promise.all([
    listSheets(user, { periodId, classroomId, q, skip, take }),
    canCreate ? assignmentsWithoutSheet(user, periodId, year.id) : Promise.resolve([]),
  ]);
  const editable = can(user, "grade:update");
  const selectedClass = classes.find((c) => c.id === classroomId);

  const columns: Column<Row>[] = [
    {
      header: "Classe",
      cell: (r) => <span className="font-semibold">{r.assignment.classroom.name}</span>,
    },
    {
      header: "Matière",
      primary: true,
      cell: (r) => (
        <Link href={`/espace/notes/${r.id}`} className="font-semibold text-primary hover:underline">
          {r.assignment.subject.name}
        </Link>
      ),
    },
    { header: "Enseignant", cell: (r) => (r.assignment.teacher ? `${r.assignment.teacher.firstName} ${r.assignment.teacher.lastName}` : "–"), hideBelow: "lg" },
    { header: "Coef.", cell: (r) => r.assignment.coefficient, hideBelow: "md", className: "text-right" },
    { header: "Formule", cell: (r) => FORMULA_SHORT[r.formula], hideBelow: "lg" },
    { header: "Saisie", cell: (r) => <Progress value={r.progress} />, hideBelow: "sm" },
    {
      header: "État",
      cell: (r) =>
        r.isLocked ? (
          <Badge tone="neutral">
            <Lock aria-hidden /> Verrouillée
          </Badge>
        ) : (
          <Badge tone="success">
            <PenLine aria-hidden /> Ouverte
          </Badge>
        ),
    },
    {
      header: "Action",
      actions: true,
      className: "text-right",
      cell: (r) => (
        <Link
          href={`/espace/notes/${r.id}`}
          className={buttonVariants({ variant: "secondary", size: "sm" })}
          aria-label={`${!r.isLocked && editable && !period.isClosed ? "Saisir" : "Consulter"} les notes de ${r.assignment.subject.name}, ${r.assignment.classroom.name}`}
        >
          {!r.isLocked && editable && !period.isClosed ? "Saisir" : "Consulter"}
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Notes"
        description={`${period.name}, ${year.label}${user.teacherId && !classroomId ? " · vos matières" : ""}`}
        actions={
          <>
            {can(user, "grade:export") && classroomId && (
              <a href={`/api/export/notes?classe=${classroomId}&periode=${periodId}`} className={buttonVariants({ variant: "secondary" })}>
                <Download aria-hidden /> Exporter (CSV)
              </a>
            )}
            {can(user, "grade:lock") && selectedClass && <ClassLockButtons classroomId={selectedClass.id} periodId={periodId} className={selectedClass.name} />}
            {canCreate && <CreateSheetDialog assignments={assignments} periods={year.periods.filter((p) => !p.isClosed)} defaultPeriodId={periodId} />}
          </>
        }
      />
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        total={total}
        page={page}
        pageSize={30}
        searchParams={sp}
        basePath="/espace/notes"
        searchPlaceholder="Matière, classe ou enseignant"
        toolbar={
          <>
            <UrlSelect param="periode" label="Période" hideLabel value={periodId} options={year.periods.map((p) => ({ value: p.id, label: `${p.name}${p.isClosed ? " (clôturée)" : ""}` }))} className="sm:w-48" />
            <UrlSelect
              param="classe"
              label="Classe"
              hideLabel
              value={classroomId ?? ""}
              allLabel={user.teacherId ? "Mes matières" : "Toutes les classes"}
              options={classes.map((c) => ({ value: c.id, label: c.name }))}
              className="sm:w-48"
            />
          </>
        }
        caption={`Fiches de notes, ${period.name}`}
        emptyTitle="Aucune fiche de notes"
        emptyDescription={canCreate ? "Créez une fiche avec « Nouvelle fiche » pour commencer la saisie." : "Aucune fiche n'a encore été ouverte pour cette période."}
      />
    </>
  );
}
