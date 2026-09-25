import { CheckCircle2, Download, FileText, Send } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AverageLevel } from "@/components/kit/level";
import { PageHeader } from "@/components/kit/page-header";
import { StatCard, StatGrid } from "@/components/kit/stat-card";
import { EmptyState } from "@/components/kit/states";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { getActiveYear, getCurrentPeriod } from "@/features/classes/academic";
import { ConfirmButton } from "@/components/kit/confirm-button";
import { UrlSelect } from "@/components/kit/url-select";
import { publishReportCards } from "@/features/report-cards/actions";
import { classPreview, publicationOverview } from "@/features/report-cards/queries";
import { can, requirePermission } from "@/lib/auth/authorize";
import { formatRank } from "@/lib/domain/report-card";
import { param } from "@/lib/list";
import { PdfDownloadLink } from "@/lib/pdf/download-link";
import { formatAverage, formatDateTime, formatPercent } from "@/lib/utils";

export const metadata: Metadata = { title: "Bulletins" };

export default async function ReportCardsPage(props: PageProps<"/espace/bulletins">) {
  const user = await requirePermission(["report_card:publish", "report_card:export"]);
  const sp = await props.searchParams;
  const [year, current] = await Promise.all([getActiveYear(), getCurrentPeriod()]);
  if (!year || !current) return <EmptyState title="Aucune année scolaire active" />;

  const periodId = year.periods.find((p) => p.id === param(sp, "periode"))?.id ?? current.id;
  const period = year.periods.find((p) => p.id === periodId)!;
  const overview = await publicationOverview(user, year.id, periodId);
  const classroomId = overview.find((c) => c.id === param(sp, "classe"))?.id;
  const preview = classroomId ? await classPreview(user, classroomId, periodId) : null;
  const canPublish = can(user, "report_card:publish");
  const canView = can(user, "report_card:view");

  const filters = (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
      <UrlSelect param="periode" label="Période" value={periodId} options={year.periods.map((p) => ({ value: p.id, label: p.name }))} className="sm:w-52" />
      <UrlSelect param="classe" label="Classe" value={classroomId ?? ""} allLabel="Vue d'ensemble" options={overview.map((c) => ({ value: c.id, label: c.name }))} className="sm:w-52" />
    </div>
  );

  if (!preview) {
    return (
      <>
        <PageHeader title="Bulletins" description={`${period.name} ${year.label} · calcul, aperçu et publication des bulletins aux familles.`} />
        {filters}
        <Card>
          <CardHeader>
            <CardTitle>Publication par classe</CardTitle>
          </CardHeader>
          {overview.length === 0 ? (
            <EmptyState title="Aucune classe" />
          ) : (
            <Table>
              <caption className="sr-only">État de publication des bulletins par classe</caption>
              <THead>
                <tr>
                  <TH>Classe</TH>
                  <TH className="text-right">Élèves</TH>
                  <TH>Bulletins publiés</TH>
                  <TH className="text-right">Action</TH>
                </tr>
              </THead>
              <tbody>
                {overview.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-semibold">{c.name}</TD>
                    <TD className="text-right tabular-nums">{c.students}</TD>
                    <TD>
                      {c.published >= c.students && c.students > 0 ? (
                        <Badge tone="success">
                          <CheckCircle2 aria-hidden /> Publiés ({c.published})
                        </Badge>
                      ) : c.published > 0 ? (
                        <Badge tone="warning">
                          {c.published} sur {c.students}
                        </Badge>
                      ) : (
                        <Badge tone="neutral">Non publiés</Badge>
                      )}
                    </TD>
                    <TD className="text-right">
                      <Link
                        href={`/espace/bulletins?classe=${c.id}&periode=${periodId}`}
                        className={buttonVariants({ variant: "secondary", size: "sm" })}
                        aria-label={`Ouvrir les bulletins de la ${c.name}`}
                      >
                        Ouvrir
                      </Link>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </>
    );
  }

  const { classroom, cards, summary, missingSheets, unlockedSheets, published } = preview;
  const publishedCount = cards.filter((c) => published.has(c.enrollmentId)).length;
  const lastPublished = [...published.values()].reduce<Date | null>((acc, p) => (!acc || p.publishedAt > acc ? p.publishedAt : acc), null);
  const sorted = [...cards].sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.name.localeCompare(b.name));
  const rankCounts = new Map<number, number>();
  for (const c of cards) if (c.rank !== null) rankCounts.set(c.rank, (rankCounts.get(c.rank) ?? 0) + 1);

  return (
    <>
      <PageHeader
        title={`Bulletins · ${classroom.name}`}
        description={`${period.name} ${year.label} · aperçu calculé à partir des notes saisies.`}
        actions={
          <>
            {can(user, "report_card:export") && (
              <a
                href={`/api/export/bulletins?classe=${classroom.id}&periode=${periodId}`}
                className={buttonVariants({ variant: "secondary" })}
              >
                <Download aria-hidden /> Exporter (CSV)
              </a>
            )}
            {can(user, "report_card:export") && cards.length > 0 && (
              <PdfDownloadLink
                href={`/api/pdf/bulletins?classe=${classroom.id}&periode=${periodId}`}
                label="Bulletins en PDF"
                description={`les ${cards.length} bulletins de la ${classroom.name}, une page par élève`}
              />
            )}
            {canPublish && (
              <ConfirmButton
                action={publishReportCards}
                fields={{ classroomId: classroom.id, periodId }}
                tone="primary"
                variant="primary"
                title={`Publier les bulletins de la ${classroom.name} ?`}
                description={`${cards.length} bulletins seront publiés pour le ${period.name}. Les parents et les élèves recevront une notification.${
                  publishedCount ? " Les bulletins déjà publiés seront remplacés par cette nouvelle version." : ""
                }${unlockedSheets.length ? ` Attention : ${unlockedSheets.length} fiche(s) de notes ne sont pas verrouillées.` : ""}`}
                confirmLabel="Publier"
              >
                <Send aria-hidden /> {publishedCount ? "Republier" : "Publier les bulletins"}
              </ConfirmButton>
            )}
          </>
        }
      />
      {filters}

      <StatGrid>
        <StatCard label="Moyenne de la classe" value={summary.classAverage !== null ? `${formatAverage(summary.classAverage)}/20` : "–"} icon={FileText} />
        <StatCard label="Taux de réussite" value={formatPercent(summary.passRate)} hint="Moyenne générale au moins égale à 10" tone="accent" />
        <StatCard label="Plus haute / plus basse" value={`${formatAverage(summary.highest)} / ${formatAverage(summary.lowest)}`} tone="info" />
        <StatCard
          label="Bulletins publiés"
          value={`${publishedCount} / ${cards.length}`}
          hint={lastPublished ? `Dernière publication : ${formatDateTime(lastPublished)}` : "Pas encore publiés"}
          tone={publishedCount === cards.length ? "primary" : "warning"}
        />
      </StatGrid>

      <div className="mt-4 flex flex-col gap-3">
        {missingSheets.length > 0 && (
          <Alert tone="warning" title="Matières sans fiche de notes">
            {missingSheets.join(", ")} : ces matières ne compteront pas dans la moyenne générale.
          </Alert>
        )}
        {unlockedSheets.length > 0 && (
          <Alert tone="info" title="Fiches encore ouvertes">
            {unlockedSheets.join(", ")} : les notes peuvent encore changer. Verrouillez les fiches depuis la page Notes avant de publier.
          </Alert>
        )}
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Classement et appréciations</CardTitle>
        </CardHeader>
        {cards.length === 0 ? (
          <EmptyState title="Aucun élève inscrit" />
        ) : (
          <Table>
            <caption className="sr-only">Aperçu des bulletins de la classe, par rang</caption>
            <THead>
              <tr>
                <TH className="text-right">Rang</TH>
                <TH>Élève</TH>
                <TH>Moyenne générale</TH>
                <TH className="max-lg:hidden">Appréciation</TH>
                <TH className="max-md:hidden">État</TH>
                <TH className="text-right">Bulletin</TH>
              </tr>
            </THead>
            <tbody>
              {sorted.map((c) => {
                const pub = published.get(c.enrollmentId);
                return (
                  <TR key={c.enrollmentId}>
                    <TD className="text-right font-semibold tabular-nums">{formatRank(c.rank, (rankCounts.get(c.rank ?? -1) ?? 0) > 1)}</TD>
                    <TD>
                      <span className="font-semibold">{c.name}</span>
                      <span className="block font-mono text-xs text-muted">{c.student.matricule}</span>
                    </TD>
                    <TD>
                      <AverageLevel average={c.generalAverage} />
                    </TD>
                    <TD className="text-muted max-lg:hidden">{c.appreciation ?? "–"}</TD>
                    <TD className="max-md:hidden">{pub ? <Badge tone="success">Publié</Badge> : <Badge tone="neutral">Aperçu</Badge>}</TD>
                    <TD className="text-right">
                      <span className="inline-flex flex-wrap justify-end gap-2">
                        <Link
                          href={`/espace/bulletins/${c.enrollmentId}/${periodId}`}
                          className={buttonVariants({ variant: "secondary", size: "sm" })}
                          aria-label={`Voir le bulletin de ${c.name}`}
                        >
                          Voir
                        </Link>
                        {canView && (
                          <PdfDownloadLink
                            href={`/api/pdf/bulletin?inscription=${c.enrollmentId}&periode=${periodId}`}
                            label="PDF"
                            size="sm"
                            description={`bulletin de ${c.name}`}
                          />
                        )}
                      </span>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
