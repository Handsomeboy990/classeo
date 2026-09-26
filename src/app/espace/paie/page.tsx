import { CheckCheck, FilePlus2, Pencil, Trash2, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { forbidden } from "next/navigation";

import { ConfirmButton } from "@/components/kit/confirm-button";
import { FormDialog } from "@/components/kit/form-dialog";
import { PageHeader } from "@/components/kit/page-header";
import { EmptyState } from "@/components/kit/states";
import { UrlSelect } from "@/components/kit/url-select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { getActiveYear } from "@/features/classes/academic";
import { advancePayslip, deletePayslip, savePayslip } from "@/features/payroll/actions";
import { PayslipFields } from "@/features/payroll/components/payslip-fields";
import { schoolPayroll } from "@/features/payroll/queries";
import { can, requirePermission } from "@/lib/auth/authorize";
import { MONTH, monthLabel, PAYROLL_STATUS_LABELS, PAYROLL_STATUS_TONES, schoolYearMonths } from "@/lib/domain/payroll";
import { isStateStatus, TEACHER_STATUS_SHORT } from "@/lib/domain/teacher-status";
import { param } from "@/lib/list";
import { PdfDownloadLink } from "@/lib/pdf/download-link";
import { formatFcfa } from "@/lib/utils";

export const metadata: Metadata = { title: "Paie du personnel" };

// The monthly payslips of the teachers the school pays: its vacataires and,
// in a private school, its own teachers. Agents of the State are listed as
// paid by the Ministry of Finance.
export default async function PayrollPage(props: PageProps<"/espace/paie">) {
  const user = await requirePermission("payroll:view");
  if (user.scope.level !== "SCHOOL") forbidden();
  const sp = await props.searchParams;
  const year = await getActiveYear();
  const months = schoolYearMonths(year ? year.startDate.getUTCFullYear() : new Date().getUTCFullYear());
  const now = new Date();
  const current = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const wanted = param(sp, "mois");
  const month = wanted && MONTH.test(wanted) ? wanted : months.includes(current) ? current : months[0]!;
  const data = await schoolPayroll(user, month);
  if (!data) forbidden();
  const canEdit = can(user, "payroll:create");
  const canApprove = can(user, "payroll:approve");
  const canPrint = can(user, "payroll:export");
  const paid = data.teachers.filter((t) => t.payslip);
  const total = paid.reduce((n, t) => n + t.payslip!.netAmount, 0);

  return (
    <>
      <PageHeader
        title="Paie du personnel"
        description={`Bulletins de ${monthLabel(month)}`}
        info={`Enseignants payés par ${data.school.name}. Les agents de l'État sont payés par le ministère de l'Économie et des Finances.`}
      />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <UrlSelect param="mois" label="Mois" value={month} options={months.map((m) => ({ value: m, label: monthLabel(m) }))} className="sm:w-56" />
        <p className="text-sm text-muted">
          {paid.length} bulletin{paid.length > 1 ? "s" : ""} · net total {formatFcfa(total)}
        </p>
      </div>
      {data.teachers.length === 0 ? (
        <Card>
          <EmptyState icon={<Wallet className="size-7" />} title="Aucun enseignant en activité" />
        </Card>
      ) : (
        <Card>
          <Table cards>
            <caption className="sr-only">Bulletins de paie de {monthLabel(month)}</caption>
            <THead>
              <TR>
                <TH>Enseignant</TH>
                <TH>Statut</TH>
                <TH className="text-right">Net</TH>
                <TH>Bulletin</TH>
                <TH>
                  <span className="sr-only">Actions</span>
                </TH>
              </TR>
            </THead>
            <tbody>
              {data.teachers.map((t) => {
                const p = t.payslip;
                const state = isStateStatus(t.status);
                return (
                  <TR key={t.id}>
                    <TD data-label="Enseignant">
                      <span className="font-semibold">
                        {t.lastName} {t.firstName}
                      </span>
                      <span className="block font-mono text-xs text-muted">{t.matricule}</span>
                    </TD>
                    <TD data-label="Statut">{t.status ? TEACHER_STATUS_SHORT[t.status] : "Non renseigné"}</TD>
                    <TD data-label="Net" className="text-right tabular-nums">
                      {p ? formatFcfa(p.netAmount) : "–"}
                    </TD>
                    <TD data-label="Bulletin">
                      {state ? (
                        <span className="text-sm text-muted">Payé par l&apos;État</span>
                      ) : p ? (
                        <Badge tone={PAYROLL_STATUS_TONES[p.status]}>{PAYROLL_STATUS_LABELS[p.status]}</Badge>
                      ) : (
                        <span className="text-sm text-muted">À préparer</span>
                      )}
                    </TD>
                    <TD data-label="Actions">
                      {!state && (
                        <span className="flex flex-wrap justify-end gap-2">
                          {canEdit && (!p || p.status === "DRAFT") && (
                            <FormDialog
                              action={savePayslip}
                              variant={p ? "ghost" : "secondary"}
                              size="sm"
                              trigger={p ? <><Pencil aria-hidden /> Modifier</> : <><FilePlus2 aria-hidden /> Préparer</>}
                              title={`Bulletin de ${t.firstName} ${t.lastName}, ${monthLabel(month)}`}
                              submitLabel="Enregistrer le brouillon"
                              wide
                            >
                              <PayslipFields teacherId={t.id} month={month} values={p} />
                            </FormDialog>
                          )}
                          {canApprove && p && p.status !== "PAID" && (
                            <ConfirmButton
                              action={advancePayslip}
                              fields={{ id: p.id }}
                              tone="primary"
                              variant="secondary"
                              size="sm"
                              title={p.status === "DRAFT" ? `Valider le bulletin de ${t.firstName} ${t.lastName} ?` : `Marquer le bulletin de ${t.firstName} ${t.lastName} comme payé ?`}
                              description={p.status === "DRAFT" ? "Une fois validé, il ne se modifie plus et l'enseignant le voit dans « Ma paie »." : `Net versé : ${formatFcfa(p.netAmount)}.`}
                              confirmLabel={p.status === "DRAFT" ? "Valider" : "Marquer payé"}
                            >
                              <CheckCheck aria-hidden /> {p.status === "DRAFT" ? "Valider" : "Marquer payé"}
                            </ConfirmButton>
                          )}
                          {can(user, "payroll:delete") && p?.status === "DRAFT" && (
                            <ConfirmButton action={deletePayslip} fields={{ id: p.id }} size="sm" variant="ghost" title="Supprimer ce brouillon ?" description="Le bulletin pourra être préparé de nouveau." confirmLabel="Supprimer" label="Supprimer le brouillon">
                              <Trash2 aria-hidden />
                            </ConfirmButton>
                          )}
                          {canPrint && p && p.status !== "DRAFT" && (
                            <PdfDownloadLink href={`/api/pdf/bulletin-paie/${p.id}`} label="PDF" description={`bulletin de paie de ${t.firstName} ${t.lastName}`} size="sm" />
                          )}
                        </span>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
