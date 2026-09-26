import { Mail, Phone, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DataTable, type Column } from "@/components/kit/data-table";
import { PageHeader } from "@/components/kit/page-header";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { YearSelect } from "@/features/calendar/components/year-select";
import { selectedYear } from "@/features/calendar/queries";
import { SchoolStatusBadge } from "@/features/school-status/components/status-badge";
import { SchoolStatusDialog } from "@/features/school-status/components/status-dialog";
import { SchoolFormDialog } from "@/features/schools/components/school-form-dialog";
import { CYCLE_LABELS, SECTOR_LABELS } from "@/features/schools/labels";
import { communeOptions, getSchoolDetail } from "@/features/schools/queries";
import { Breakdown } from "@/features/statistics/components/breakdown";
import { IndicatorCards } from "@/features/statistics/components/indicator-cards";
import { sortParams } from "@/features/statistics/params";
import { getStatistics } from "@/features/statistics/queries";
import { ScopeBreadcrumb } from "@/features/territory/components/scope-breadcrumb";
import { requireSchoolInScope } from "@/features/territory/scope";
import { can, requirePermission } from "@/lib/auth/authorize";
import { supervisionOf } from "@/lib/domain/chains";
import { defaultPeriodicity, PERIODICITY_LABELS } from "@/lib/domain/periodicity";
import { fileUrl } from "@/lib/files";
import { formatDate, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Établissement" };

type Detail = NonNullable<Awaited<ReturnType<typeof getSchoolDetail>>>;
type ClassRow = Detail["classes"][number];

export default async function SchoolDetailPage({ params, searchParams }: PageProps<"/espace/etablissements/[id]">) {
  const user = await requirePermission("school:view");
  const { id } = await params;
  await requireSchoolInScope(user, id);
  const sp = await searchParams;
  const { year, options: years } = await selectedYear(sp);
  const detail = await getSchoolDetail(user, id, year?.id ?? null);
  if (!detail) notFound();
  const { school, classes, staffUsers, teachers, director } = detail;
  const supervision = supervisionOf({ cycle: school.cycle, departmentName: school.commune.department.name, communeName: school.commune.name });
  const yearLabel = year?.label ?? "";
  const { sort, direction } = sortParams(sp);

  const showStats = can(user, "statistics:view");
  const canEdit = can(user, "school:update");
  const [stats, communes] = await Promise.all([
    showStats ? getStatistics({ level: "SCHOOL", id: school.id }) : Promise.resolve(null),
    canEdit ? communeOptions(user) : Promise.resolve([]),
  ]);

  const classColumns: Column<ClassRow>[] = [
    { header: "Classe", cell: (c) => <span className="font-semibold">{c.name}</span> },
    { header: "Niveau", cell: (c) => c.level.name },
    { header: "Professeur principal", cell: (c) => (c.mainTeacher ? `${c.mainTeacher.firstName} ${c.mainTeacher.lastName}` : "–"), hideBelow: "md" },
    {
      header: "Effectif",
      className: "text-right tabular-nums",
      cell: (c) => (
        <span>
          {formatNumber(c._count.enrollments)} / {formatNumber(c.capacity)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={school.name}
        description={`${school.code} · ${school.commune.name}, ${school.commune.department.name}`}
        actions={
          <>
            {canEdit && (
              <SchoolFormDialog
                communes={communes}
                school={{
                  id: school.id,
                  name: school.name,
                  sector: school.sector,
                  cycle: school.cycle,
                  communeId: school.communeId,
                  address: school.address,
                  phone: school.phone,
                  email: school.email,
                  periodicity: school.periodicity === defaultPeriodicity(school) ? "" : school.periodicity,
                }}
                canSetPeriodicity={user.scope.level === "NATIONAL"}
              />
            )}
            {can(user, "school:lock") && ["NATIONAL", "DEPARTMENT", "COMMUNE"].includes(user.scope.level) && <SchoolStatusDialog id={school.id} name={school.name} status={school.status} />}
          </>
        }
      />
      <ScopeBreadcrumb scope={{ level: "SCHOOL", id: school.id }} basePath="/espace/territoire" user={user} />
      {school.status !== "ACTIVE" && (
        <Alert tone={school.status === "SUSPENDED" ? "warning" : "danger"} title={`Établissement ${school.status === "SUSPENDED" ? "suspendu" : "fermé"}${school.statusChangedAt ? ` depuis le ${formatDate(school.statusChangedAt)}` : ""}`}>
          <p>Ses données restent consultables ; aucune modification n&apos;est acceptée.{school.statusReason ? ` Motif : ${school.statusReason}` : ""}</p>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 *:min-w-0 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Identité</CardTitle>
            <SchoolStatusBadge status={school.status} reason={school.statusReason} />
          </CardHeader>
          <CardBody>
            {(school.logoFileId || school.motto) && (
              <div className="mb-3 flex items-center gap-3">
                {school.logoFileId && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fileUrl(school.logoFileId)!} alt={`Logo de ${school.name}`} className="size-14 rounded-control border border-border object-contain" />
                )}
                {school.motto && <p className="text-sm italic text-muted">« {school.motto} »</p>}
              </div>
            )}
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">Secteur</dt>
              <dd>{SECTOR_LABELS[school.sector]}</dd>
              <dt className="text-muted">Cycle</dt>
              <dd>{CYCLE_LABELS[school.cycle]}</dd>
              <dt className="text-muted">Tutelle</dt>
              <dd>
                {[supervision.ministry.short, supervision.direction, supervision.circonscription].filter(Boolean).join(", ")}
              </dd>
              <dt className="text-muted">Évaluation</dt>
              <dd>
                {PERIODICITY_LABELS[school.periodicity]}
                {school.periodicity !== defaultPeriodicity(school) && " (choix du ministère)"}
              </dd>
              <dt className="text-muted">Adresse</dt>
              <dd>{school.address ?? "Non renseignée"}</dd>
              <dt className="text-muted">Téléphone</dt>
              <dd>{school.phone ?? "Non renseigné"}</dd>
              <dt className="text-muted">E-mail</dt>
              <dd className="break-all">{school.email ?? "Non renseigné"}</dd>
              {school.postalBox && (
                <>
                  <dt className="text-muted">Boîte postale</dt>
                  <dd>{school.postalBox}</dd>
                </>
              )}
              {school.website && (
                <>
                  <dt className="text-muted">Site web</dt>
                  <dd className="break-all">
                    <a href={school.website} className="text-primary hover:underline" rel="noopener noreferrer" target="_blank">
                      {school.website}
                    </a>
                  </dd>
                </>
              )}
              <dt className="text-muted">Créé le</dt>
              <dd>{formatDate(school.createdAt)}</dd>
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Direction</CardTitle>
          </CardHeader>
          <CardBody className="text-sm">
            {director ? (
              <ul className="flex flex-col gap-2">
                <li className="flex items-center gap-2">
                  <UserRound className="size-4 text-muted" aria-hidden />
                  <span className="font-semibold">
                    {director.firstName} {director.lastName}
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="size-4 text-muted" aria-hidden />
                  <a href={`mailto:${director.email}`} className="break-all text-primary hover:underline">
                    {director.email}
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="size-4 text-muted" aria-hidden />
                  {director.phone ? (
                    <a href={`tel:${director.phone.replace(/\s/g, "")}`} className="text-primary hover:underline">
                      {director.phone}
                    </a>
                  ) : (
                    <span className="text-muted">Téléphone non renseigné</span>
                  )}
                </li>
              </ul>
            ) : (
              <p className="text-muted">Aucun compte de chef d&apos;établissement actif.</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Personnel</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-muted">Enseignants actifs</dt>
                <dd className="font-display text-2xl font-bold">{formatNumber(teachers)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Comptes actifs</dt>
                <dd className="font-display text-2xl font-bold">{formatNumber(staffUsers)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Classes {yearLabel}</dt>
                <dd className="font-display text-2xl font-bold">{formatNumber(classes.length)}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>

      {stats && <IndicatorCards stats={stats} requestsHref={can(user, "request:view") ? "/espace/demandes?statut=PENDING" : undefined} />}

      <section aria-labelledby="classes-title" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="classes-title" className="text-lg font-bold">
            Classes de l&apos;année {yearLabel}
          </h2>
          <YearSelect options={years} value={year?.id} />
        </div>
        <DataTable
          rows={classes}
          columns={classColumns}
          rowKey={(c) => c.id}
          basePath={`/espace/etablissements/${school.id}`}
          pageSize={Math.max(20, classes.length)}
          searchPlaceholder={false}
          caption={`Classes de ${school.name}`}
          emptyTitle="Aucune classe"
          emptyDescription={`Aucune classe ouverte en ${yearLabel} dans cet établissement.`}
        />
      </section>

      {stats && stats.children.length > 0 && (
        <Breakdown stats={stats} sort={sort} direction={direction} basePath={`/espace/etablissements/${school.id}`} searchParams={sp} title="Indicateurs par classe" />
      )}
    </div>
  );
}
