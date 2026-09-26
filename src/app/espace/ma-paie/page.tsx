import { ExternalLink, Landmark, Wallet } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/kit/page-header";
import { EmptyState } from "@/components/kit/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { myPay } from "@/features/payroll/queries";
import { requirePermission } from "@/lib/auth/authorize";
import { monthLabel, PAYROLL_STATUS_LABELS, PAYROLL_STATUS_TONES, STATE_PAYSLIP_PORTAL, STATE_PAYSLIP_PORTAL_LABEL } from "@/lib/domain/payroll";
import { isStateStatus, TEACHER_STATUS_LABELS } from "@/lib/domain/teacher-status";
import { PdfDownloadLink } from "@/lib/pdf/download-link";
import { formatFcfa } from "@/lib/utils";

export const metadata: Metadata = { title: "Ma paie" };

// A teacher's pay. An agent of the State finds the way to the Ministry of
// Finance portal, with the matricule to use; a teacher paid by a school
// reads the payslips that school has validated.
export default async function MyPayPage() {
  const user = await requirePermission("payslip:view");
  const pay = await myPay(user);
  const state = pay && isStateStatus(pay.stateStatus) ? pay.stateStatus : null;
  const paidBySchools = (pay?.teachers ?? []).filter((t) => !isStateStatus(t.status));
  const payslips = (pay?.teachers ?? []).flatMap((t) => t.payrolls.map((p) => ({ ...p, school: t.school.name })));

  return (
    <>
      <PageHeader title="Ma paie" description="Qui vous paie, et vos bulletins de paie." />
      <div className="flex flex-col gap-6">
        {state && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="size-5" aria-hidden /> Salaire versé par l&apos;État
              </CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-3 text-sm">
              <p>
                Vous êtes {TEACHER_STATUS_LABELS[state].charAt(0).toLowerCase() + TEACHER_STATUS_LABELS[state].slice(1)}. Votre salaire est versé par le ministère de l&apos;Économie et des Finances, qui publie vos
                bulletins de paie sur son portail. Ni l&apos;établissement ni la direction départementale ne les établissent.
              </p>
              <p>
                Sur le portail, connectez-vous avec votre matricule{pay?.stateMatricule ? <> <strong className="font-mono">{pay.stateMatricule}</strong></> : ""}, vos nom et prénoms et votre adresse électronique.
              </p>
              <a href={STATE_PAYSLIP_PORTAL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 self-start font-semibold text-primary hover:underline">
                Ouvrir {STATE_PAYSLIP_PORTAL_LABEL} <ExternalLink className="size-4" aria-hidden />
              </a>
            </CardBody>
          </Card>
        )}
        {(paidBySchools.length > 0 || payslips.length > 0 || !state) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="size-5" aria-hidden /> Bulletins de l&apos;établissement
              </CardTitle>
            </CardHeader>
            {payslips.length === 0 ? (
              <EmptyState
                title="Aucun bulletin pour le moment"
                description={
                  paidBySchools.length
                    ? `${paidBySchools.map((t) => t.school.name).join(", ")} vous paie : vos bulletins apparaissent ici dès qu'ils sont validés.`
                    : "Aucun établissement ne vous a encore remis de bulletin de paie."
                }
              />
            ) : (
              <Table cards>
                <caption className="sr-only">Mes bulletins de paie</caption>
                <THead>
                  <TR>
                    <TH>Mois</TH>
                    <TH>Établissement</TH>
                    <TH className="text-right">Net</TH>
                    <TH>État</TH>
                    <TH>
                      <span className="sr-only">Télécharger</span>
                    </TH>
                  </TR>
                </THead>
                <tbody>
                  {payslips.map((p) => (
                    <TR key={p.id}>
                      <TD data-label="Mois" className="font-semibold">
                        {monthLabel(p.month)}
                      </TD>
                      <TD data-label="Établissement">{p.school}</TD>
                      <TD data-label="Net" className="text-right tabular-nums">
                        {formatFcfa(p.netAmount)}
                      </TD>
                      <TD data-label="État">
                        <Badge tone={PAYROLL_STATUS_TONES[p.status]}>{PAYROLL_STATUS_LABELS[p.status]}</Badge>
                      </TD>
                      <TD data-label="Télécharger">
                        <PdfDownloadLink href={`/api/pdf/ma-paie/${p.id}`} label="PDF" description={`bulletin de paie de ${monthLabel(p.month)}`} size="sm" />
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
