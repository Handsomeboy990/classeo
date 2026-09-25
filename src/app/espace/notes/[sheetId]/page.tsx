import { Download, Lock, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/kit/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmButton } from "@/components/kit/confirm-button";
import { deleteSheet } from "@/features/grades/actions";
import { GradeGrid } from "@/features/grades/components/grade-grid";
import { SheetLockButton, SheetSettingsDialog } from "@/features/grades/components/sheet-forms";
import { getSheetForEntry } from "@/features/grades/queries";
import { can, requirePermission } from "@/lib/auth/authorize";
import { FORMULA_LABELS } from "@/lib/domain/grade-entry";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Saisie des notes" };

export default async function SheetPage(props: PageProps<"/espace/notes/[sheetId]">) {
  const user = await requirePermission("grade:view");
  const { sheetId } = await props.params;
  const data = await getSheetForEntry(user, sheetId);
  if (!data) notFound();
  const { sheet, columns, rows, inWriteScope } = data;
  const a = sheet.assignment;

  const canWrite = can(user, "grade:update") && inWriteScope;
  const editable = canWrite && !sheet.isLocked && !sheet.period.isClosed;
  const readOnlyReason = sheet.isLocked
    ? `Fiche verrouillée${sheet.lockedBy ? ` par ${sheet.lockedBy.firstName} ${sheet.lockedBy.lastName}` : ""}${sheet.lockedAt ? ` le ${formatDateTime(sheet.lockedAt)}` : ""}`
    : sheet.period.isClosed
      ? "Période clôturée"
      : "Consultation seule";
  const label = `${a.subject.name}, ${a.classroom.name}`;
  const hasGrades = rows.some((r) => Object.keys(r.values).length > 0);

  return (
    <>
      <nav aria-label="Fil d'Ariane" className="mb-2 text-sm text-muted max-lg:hidden">
        <Link href="/espace/notes" className="hover:underline">
          Notes
        </Link>{" "}
        /{" "}
        <Link href={`/espace/notes?classe=${a.classroom.id}&periode=${sheet.period.id}`} className="hover:underline">
          {a.classroom.name}
        </Link>{" "}
        / {a.subject.name}
      </nav>
      <PageHeader
        title={`${a.subject.name} · ${a.classroom.name}`}
        description={`${sheet.period.name}, ${sheet.period.academicYear.label} · coefficient ${a.coefficient} · ${a.teacher ? `${a.teacher.firstName} ${a.teacher.lastName}` : "enseignant non désigné"}`}
        actions={
          <>
            {sheet.isLocked && (
              <Badge tone="neutral" className="h-8 px-3 text-sm">
                <Lock aria-hidden /> Verrouillée
              </Badge>
            )}
            {can(user, "grade:export") && (
              <a href={`/api/export/notes?fiche=${sheet.id}`} className={buttonVariants({ variant: "secondary" })}>
                <Download aria-hidden /> CSV
              </a>
            )}
            {editable && (
              <SheetSettingsDialog
                id={sheet.id}
                values={{ formula: sheet.formula, interrogationCount: sheet.interrogationCount, devoirCount: sheet.devoirCount, compositionCount: sheet.compositionCount }}
              />
            )}
            {editable && can(user, "grade:delete") && !hasGrades && (
              <ConfirmButton
                action={deleteSheet}
                fields={{ id: sheet.id }}
                title={`Supprimer la fiche ${label} ?`}
                description="La fiche ne contient aucune note. Elle pourra être recréée."
                confirmLabel="Supprimer"
                variant="ghost"
                label="Supprimer la fiche"
              >
                <Trash2 aria-hidden />
              </ConfirmButton>
            )}
            {can(user, "grade:lock") && inWriteScope && <SheetLockButton id={sheet.id} locked={sheet.isLocked} label={label} />}
          </>
        }
      />
      <p className="mb-4 text-sm text-muted">
        <span className="font-semibold text-text">Formule : </span>
        {FORMULA_LABELS[sheet.formula]}. Une évaluation manquante est ignorée avec son poids.
      </p>
      {sheet.isLocked && canWrite && (
        <Alert tone="info" className="mb-4">
          Cette fiche est verrouillée par la direction. Pour corriger une note, demandez son déverrouillage.
        </Alert>
      )}
      <GradeGrid sheetId={sheet.id} formula={sheet.formula} columns={columns} rows={rows} editable={editable} readOnlyReason={readOnlyReason} />
    </>
  );
}
