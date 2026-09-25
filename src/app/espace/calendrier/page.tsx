import { CalendarPlus, CalendarRange, Lock, LockOpen, Pencil, Play, TimerReset } from "lucide-react";
import type { Metadata } from "next";

import { ConfirmButton } from "@/components/kit/confirm-button";
import { FormDialog } from "@/components/kit/form-dialog";
import { PageHeader } from "@/components/kit/page-header";
import { EmptyState } from "@/components/kit/states";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { activateYear, createExtension, endExtension, saveYear, setYearClosed } from "@/features/calendar/actions";
import { ExtensionFields } from "@/features/calendar/components/extension-fields";
import { YearFields, type YearFormValues } from "@/features/calendar/components/year-fields";
import { extensionSchoolOptions, listYears, schoolYearAccess } from "@/features/calendar/queries";
import { isoToUtc, toIso, YEAR_STATUS_LABELS, YEAR_STATUS_TONES } from "@/features/calendar/rules";
import { can, requirePermission } from "@/lib/auth/authorize";
import { formatDate, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Calendrier scolaire" };

type Year = Awaited<ReturnType<typeof listYears>>[number];

function formValues(y: Year): YearFormValues {
  return {
    id: y.id,
    label: y.label,
    startDate: toIso(y.startDate),
    endDate: toIso(y.endDate),
    periods: y.periods.map((p) => ({ name: p.name, startDate: toIso(p.startDate), endDate: toIso(p.endDate) })),
  };
}

// The year after the most recent one, as a starting point for the form.
function nextYearValues(latest: Year | undefined): YearFormValues {
  const first = latest ? latest.startDate.getUTCFullYear() + 1 : new Date().getUTCFullYear();
  const start = isoToUtc(`${first}-09-14`);
  const end = isoToUtc(`${first + 1}-07-02`);
  return {
    label: `${first}-${first + 1}`,
    startDate: toIso(start),
    endDate: toIso(end),
    // Three terms separated by the Christmas and Easter holidays, as usual.
    periods: [
      { name: "Trimestre 1", startDate: toIso(start), endDate: `${first}-12-18` },
      { name: "Trimestre 2", startDate: `${first + 1}-01-04`, endDate: `${first + 1}-03-26` },
      { name: "Trimestre 3", startDate: `${first + 1}-04-12`, endDate: toIso(end) },
    ],
  };
}

export default async function CalendarPage() {
  const user = await requirePermission("calendar:view");
  const ministry = user.scope.level === "NATIONAL";
  const canEdit = ministry && can(user, "calendar:update");
  const canCreate = canEdit && can(user, "calendar:create");
  const canClose = ministry && can(user, "calendar:lock");
  const canExtend = ministry && can(user, "calendar:approve");

  const now = new Date();
  const [years, schools] = await Promise.all([listYears(user, now), canExtend ? extensionSchoolOptions(user) : Promise.resolve([])]);
  const pickable = schools.map((s) => ({ id: s.id, name: s.name, code: s.code, commune: s.commune.name }));
  const inTwoWeeks = toIso(new Date(now.getTime() + 14 * 86_400_000));

  // School staff: what their own school may still do in the current year.
  const active = years.find((y) => y.isActive) ?? null;
  const schoolId = user.scope.level === "SCHOOL" ? user.scope.schoolId : null;
  const access = schoolId && active ? await schoolYearAccess(schoolId, active.id, now) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Calendrier scolaire"
        description={
          ministry
            ? "Le ministère fixe les années et leurs périodes. Tous les établissements, publics et privés, suivent ce calendrier."
            : "Calendrier fixé par le ministère pour tous les établissements, publics et privés."
        }
        actions={
          canCreate ? (
            <FormDialog action={saveYear} trigger={<><CalendarPlus aria-hidden /> Nouvelle année</>} title="Nouvelle année scolaire" description="Les dates et les périodes s'appliquent à tous les établissements." submitLabel="Créer l'année" wide>
              <YearFields values={nextYearValues(years[0])} />
            </FormDialog>
          ) : null
        }
      />

      {access && active && (
        <Alert tone={access.closed ? (access.extendedUntil ? "info" : "warning") : "success"} title={`Année ${active.label}`}>
          {access.closed
            ? access.extendedUntil
              ? `L'année est close, mais une prolongation ${access.extensionForAll ? "accordée à tous les établissements" : "accordée à votre établissement"} vous permet de terminer la saisie jusqu'au ${formatDate(access.extendedUntil)}.`
              : "L'année est close : ses données se consultent mais ne se modifient plus. Pour terminer une saisie, déposez une demande de prolongation depuis la page Demandes."
            : `Votre établissement peut saisir jusqu'au ${formatDate(active.endDate)}, fin de l'année.`}
        </Alert>
      )}

      {years.length === 0 ? (
        <EmptyState title="Aucune année scolaire" description={canCreate ? "Créez la première année scolaire et ses périodes." : "Le ministère n'a pas encore publié de calendrier."} icon={<CalendarRange />} />
      ) : (
        years.map((y) => {
          const titleId = `year-${y.id}`;
          const running = y.extensions.filter((e) => e.running);
          const past = y.extensions.filter((e) => !e.running);
          return (
            <Card key={y.id} aria-labelledby={titleId}>
              <CardHeader>
                <div className="min-w-0">
                  <CardTitle id={titleId} className="flex flex-wrap items-center gap-2 text-lg">
                    Année {y.label}
                    <Badge tone={YEAR_STATUS_TONES[y.status]} dot>
                      {YEAR_STATUS_LABELS[y.status]}
                    </Badge>
                    {y.closed && running.length > 0 && <Badge tone="info">{running.length === 1 ? "1 prolongation en cours" : `${running.length} prolongations en cours`}</Badge>}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted">
                    Du {formatDate(y.startDate)} au {formatDate(y.endDate)}
                    {y.closedAt && y.closedAt <= now ? `, close par le ministère le ${formatDate(y.closedAt)}` : ""}
                    {` · ${formatNumber(y._count.enrollments)} inscriptions, ${formatNumber(y._count.classrooms)} classes`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canEdit && !y.closed && (
                    <FormDialog action={saveYear} trigger={<><Pencil aria-hidden /> Modifier</>} triggerVariant="secondary" triggerSize="sm" triggerLabel={`Modifier l'année ${y.label}`} title={`Modifier l'année ${y.label}`} wide>
                      <YearFields values={formValues(y)} />
                    </FormDialog>
                  )}
                  {canEdit && !y.closed && !y.isActive && (
                    <ConfirmButton
                      action={activateYear}
                      fields={{ id: y.id }}
                      tone="primary"
                      variant="soft"
                      size="sm"
                      label={`Activer l'année ${y.label}`}
                      title={`Faire de ${y.label} l'année en cours ?`}
                      description="Les inscriptions, les classes, les notes et les frais de tous les établissements porteront désormais sur cette année. L'année en cours actuelle reste consultable."
                      confirmLabel="Activer"
                    >
                      <Play aria-hidden /> Activer
                    </ConfirmButton>
                  )}
                  {canClose && !y.closed && (
                    <ConfirmButton
                      action={setYearClosed}
                      fields={{ id: y.id, close: "true" }}
                      variant="danger-ghost"
                      size="sm"
                      label={`Clôturer l'année ${y.label}`}
                      title={`Clôturer l'année ${y.label} ?`}
                      description="Tous les établissements passent cette année en lecture seule : notes, présences, inscriptions, frais. Vous pourrez accorder une prolongation à certains établissements."
                      confirmLabel="Clôturer l'année"
                    >
                      <Lock aria-hidden /> Clôturer
                    </ConfirmButton>
                  )}
                  {canClose && y.closedAt && y.closedAt <= now && y.endDate.getTime() + 86_400_000 > now.getTime() && (
                    <ConfirmButton
                      action={setYearClosed}
                      fields={{ id: y.id, close: "false" }}
                      tone="primary"
                      variant="secondary"
                      size="sm"
                      label={`Rouvrir l'année ${y.label}`}
                      title={`Rouvrir l'année ${y.label} ?`}
                      description="Les établissements pourront de nouveau modifier les données de cette année jusqu'à sa date de fin."
                      confirmLabel="Rouvrir"
                    >
                      <LockOpen aria-hidden /> Rouvrir
                    </ConfirmButton>
                  )}
                  {canExtend && y.closed && (
                    <FormDialog
                      action={createExtension}
                      trigger={<><TimerReset aria-hidden /> Prolonger</>}
                      triggerVariant="secondary"
                      triggerSize="sm"
                      triggerLabel={`Prolonger l'année ${y.label}`}
                      title={`Prolonger l'année ${y.label}`}
                      description="Les établissements concernés pourront terminer leur saisie jusqu'à la date choisie."
                      submitLabel="Accorder la prolongation"
                      wide
                    >
                      <ExtensionFields academicYearId={y.id} schools={pickable} defaultUntil={inTwoWeeks} />
                    </FormDialog>
                  )}
                </div>
              </CardHeader>
              <CardBody className="grid gap-5 lg:grid-cols-2">
                <section aria-label={`Périodes ${y.label}`}>
                  <h3 className="mb-2 text-sm font-semibold text-muted">Périodes</h3>
                  <ol className="flex flex-col gap-2">
                    {y.periods.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-control border border-border px-3 py-2">
                        <span className="font-semibold">{p.name}</span>
                        <span className="text-sm text-muted">
                          {formatDate(p.startDate)} au {formatDate(p.endDate)}
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
                <section aria-label={`Prolongations ${y.label}`}>
                  <h3 className="mb-2 text-sm font-semibold text-muted">Prolongations</h3>
                  {y.extensions.length === 0 ? (
                    <p className="text-sm text-muted">Aucune prolongation{ministry ? "." : " pour votre périmètre."}</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {[...running, ...past].slice(0, 12).map((e) => (
                        <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-border px-3 py-2">
                          <div className="min-w-0">
                            <p className="font-semibold">{e.school ? e.school.name : "Tous les établissements"}</p>
                            <p className="text-sm text-muted">
                              Jusqu&apos;au {formatDate(e.until)} · {e.reason}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {e.running ? <Badge tone="info">En cours</Badge> : <Badge>Terminée</Badge>}
                            {canExtend && e.running && (
                              <ConfirmButton
                                action={endExtension}
                                fields={{ id: e.id }}
                                variant="danger-ghost"
                                size="sm"
                                label={`Terminer la prolongation de ${e.school?.name ?? "tous les établissements"}`}
                                title="Terminer cette prolongation ?"
                                description="L'année repasse aussitôt en lecture seule pour les établissements concernés."
                                confirmLabel="Terminer"
                              >
                                Terminer
                              </ConfirmButton>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </CardBody>
            </Card>
          );
        })
      )}
    </div>
  );
}
