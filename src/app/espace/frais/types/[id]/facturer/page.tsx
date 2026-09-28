import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/kit/page-header";
import { StatCard, StatGrid } from "@/components/kit/stat-card";
import { EmptyState } from "@/components/kit/states";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { requireFeeStaff, startOfToday } from "@/features/fees/access";
import { GenerateForm } from "@/features/fees/components/generate-form";
import { getGenerationPreview } from "@/features/fees/queries";
import { formatDate, formatFcfa, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Générer les factures" };

// Dry run first: the page lists who will be billed and who is skipped, the
// user confirms, and only then are invoices created.
export default async function GenerateInvoicesPage({ params }: PageProps<"/espace/frais/types/[id]/facturer">) {
  const user = await requireFeeStaff("fee:create");
  const { id } = await params;
  const preview = await getGenerationPreview(user, id);
  if (!preview) notFound();
  const { feeType, schedule } = preview;

  return (
    <>
      <Link href="/espace/frais/types" className="mb-3 inline-flex max-lg:hidden items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Types de frais
      </Link>
      <PageHeader
        title={`Générer les factures : ${feeType.name}`}
        description={`${formatFcfa(feeType.amount)} par élève · ${feeType.level ? `niveau ${feeType.level.name}` : "tous les niveaux"} · année ${feeType.academicYear.label}. Aperçu avant création.`}
      />

      <div className="flex flex-col gap-6">
        <StatGrid wide>
          <StatCard label="Élèves concernés" value={formatNumber(preview.concerned)} />
          <StatCard label="Factures à créer" value={formatNumber(preview.toCreate)} />
          <StatCard label="Déjà facturés, ignorés" value={formatNumber(preview.skipped)} />
          <StatCard label="Montant total" value={formatFcfa(preview.total)} />
        </StatGrid>

        {!feeType.isActive && <Alert tone="warning" title="Type de frais désactivé">Réactivez-le avant de générer des factures.</Alert>}

        <div className="grid grid-cols-1 gap-6 *:min-w-0 lg:grid-cols-[3fr_2fr]">
          <Card>
            <CardHeader>
              <CardTitle>Répartition par classe</CardTitle>
            </CardHeader>
            {preview.classes.length === 0 ? (
              <EmptyState title="Aucun élève inscrit dans ce niveau" description="Vérifiez le niveau choisi pour ce type de frais." />
            ) : (
              <Table>
                <caption className="sr-only">Factures à créer par classe</caption>
                <THead>
                  <tr>
                    <TH>Classe</TH>
                    <TH className="text-right">À facturer</TH>
                    <TH className="text-right">Déjà facturés</TH>
                    <TH className="text-right max-sm:hidden">Montant</TH>
                  </tr>
                </THead>
                <tbody>
                  {preview.classes.map((c) => (
                    <TR key={c.id}>
                      <TD className="font-medium">{c.name}</TD>
                      <TD className="text-right tabular-nums">{formatNumber(c.toCreate)}</TD>
                      <TD className="text-right tabular-nums text-muted">{formatNumber(c.skipped)}</TD>
                      <TD className="text-right tabular-nums max-sm:hidden">{formatFcfa(c.toCreate * feeType.amount)}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tranches de chaque facture</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              {schedule ? (
                <ol className="divide-y divide-border rounded-card border border-border text-sm">
                  {schedule.map((s) => (
                    <li key={s.label} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                      <span className="font-medium">
                        {s.label} · {s.percent} %
                      </span>
                      <span className="text-muted">
                        {formatFcfa(s.amount)} avant le {formatDate(s.dueDate)}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted">Pas d&apos;échéancier actif : chaque facture sera payable en une fois.</p>
              )}
              {preview.toCreate === 0 ? (
                <Alert tone="info" title="Rien à créer">
                  Tous les élèves concernés ont déjà une facture pour ce type de frais.
                </Alert>
              ) : (
                <GenerateForm
                  feeTypeId={feeType.id}
                  toCreate={preview.toCreate}
                  total={preview.total}
                  needsDueDate={!schedule}
                  today={startOfToday().toISOString().slice(0, 10)}
                />
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
