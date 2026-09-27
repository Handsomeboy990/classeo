import { Building2, Clock, LayoutGrid, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { FormDialog } from "@/components/kit/form-dialog";
import { InfoTip } from "@/components/kit/info-tip";
import { PageHeader } from "@/components/kit/page-header";
import { StatCard, StatGrid } from "@/components/kit/stat-card";
import { EmptyState } from "@/components/kit/states";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { CYCLE_LABELS, SECTOR_LABELS } from "@/features/schools/labels";
import { shortDate } from "@/features/students/labels";
import { recordStateTeacher } from "@/features/teachers/actions";
import { StateTeacherFields } from "@/features/teachers/components/state-registry-fields";
import { getTeacherFile, type TeacherFile } from "@/features/teachers/file";
import { weekDays } from "@/features/teachers/file-rules";
import { requirePermission } from "@/lib/auth/authorize";
import { chainOfCycle, MINISTRY_OF } from "@/lib/domain/chains";
import { isStateStatus, PAYER_LABELS, payerOf, TEACHER_STATUS_LABELS, TEACHER_STATUS_SHORT } from "@/lib/domain/teacher-status";
import { PdfDownloadLink } from "@/lib/pdf/download-link";
import { formatDateTime, formatNumber, plural } from "@/lib/utils";

export const metadata: Metadata = { title: "Fiche enseignant" };

const GENDER = { F: "Femme", M: "Homme" } as const;

// The file of a person of the national registry: every school of the
// viewer's territory where they teach, their courses, their years and their
// activity. The record of each appointment stays at /espace/enseignants/[id].
export default async function TeacherFilePage(props: PageProps<"/espace/enseignants/registre/[profileId]">) {
  const user = await requirePermission("teacher:view");
  const { profileId } = await props.params;
  const file = await getTeacherFile(user, profileId);
  if (!file) notFound();
  const { profile: p, rights } = file;
  const name = `${p.firstName} ${p.lastName}`;
  const active = file.appointments.filter((a) => a.isActive);
  const totals = file.current.reduce((t, c) => ({ hours: t.hours + c.hours, classes: t.classes + c.classes, students: t.students + c.students }), { hours: 0, classes: 0, students: 0 });
  const status = p.stateStatus ?? file.appointments.find((a) => a.isActive && a.status)?.status ?? null;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Registre des enseignants", href: "/espace/enseignants" }, { label: name }]}
        title={name}
        description={[p.npi ? `NPI ${p.npi}` : "Sans NPI", status ? TEACHER_STATUS_SHORT[status] : null, p.stateMatricule ? `matricule de l'État ${p.stateMatricule}` : null, file.specialty]
          .filter(Boolean)
          .join(" · ")}
        info="Fiche de la personne au registre national : ses établissements de votre périmètre, ses enseignements, son parcours et son activité. Chaque établissement garde sa propre fiche de nomination."
        actions={
          <>
            <PdfDownloadLink href={`/api/pdf/fiche-enseignant/${p.id}`} label="Fiche (PDF)" description={`fiche enseignant de ${name}`} />
            {rights.registry && (
              <FormDialog
                action={recordStateTeacher}
                triggerVariant="secondary"
                trigger={<>{p.stateStatus ? "Modifier le registre" : "Inscrire à l'État"}</>}
                title={`Agent de l'État : ${name}`}
                description="Statut et matricule de l'État. Ses nominations dans les établissements publics prennent ce statut."
                submitLabel="Enregistrer"
              >
                <StateTeacherFields
                  values={{ profileId: p.id, lastName: p.lastName, firstName: p.firstName, gender: p.gender, phone: p.phone, npi: p.npi, stateStatus: p.stateStatus, stateMatricule: p.stateMatricule }}
                />
              </FormDialog>
            )}
          </>
        }
      />

      <StatGrid>
        <StatCard label="Établissements" value={formatNumber(active.length)} hint={file.hiddenActive ? `et ${plural(file.hiddenActive, "autre")} hors périmètre` : "en activité"} icon={Building2} />
        <StatCard label="Classes" value={formatNumber(totals.classes)} hint={file.year ? `Année ${file.year.label}` : undefined} icon={LayoutGrid} />
        <StatCard label="Heures par semaine" value={formatNumber(totals.hours)} icon={Clock} />
        <StatCard label="Élèves suivis" value={formatNumber(totals.students)} icon={Users} />
      </StatGrid>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Identity file={file} name={name} />
          <Schools file={file} />
          <CurrentYear file={file} />
          <History file={file} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Activity file={file} />
          <Pay file={file} />
          <Registry file={file} />
        </div>
      </div>
    </>
  );
}

// Each card is a region named by its title.
function Title({ id, children, info, label }: { id: string; children: ReactNode; info?: ReactNode; label?: string }) {
  return (
    <CardHeader>
      <div className="flex items-center gap-1.5">
        <CardTitle id={id}>{children}</CardTitle>
        {info && <InfoTip label={label}>{info}</InfoTip>}
      </div>
    </CardHeader>
  );
}

function Pairs({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm [&_dd]:min-w-0 [&_dd]:break-words">{children}</dl>;
}

function Identity({ file, name }: { file: TeacherFile; name: string }) {
  const p = file.profile;
  return (
    <Card aria-labelledby="file-identity">
      <Title id="file-identity">Identité</Title>
      <CardBody>
        <div className="mb-4 flex items-center gap-3">
          <Avatar name={name} className="size-14 text-lg" />
          <div className="min-w-0">
            <p className="font-semibold break-words">{name}</p>
            <p className="text-sm text-muted">{p.gender ? GENDER[p.gender] : "Sexe non renseigné"}</p>
          </div>
        </div>
        <Pairs>
          <dt className="text-muted">NPI</dt>
          <dd className="tabular-nums">{p.npi ?? "Non renseigné"}</dd>
          <dt className="text-muted">Spécialité</dt>
          <dd>{file.specialty ?? "Non renseignée"}</dd>
          <dt className="text-muted">Au registre depuis</dt>
          <dd>{shortDate(p.createdAt)}</dd>
          {file.rights.contacts && (
            <>
              <dt className="text-muted">Téléphone</dt>
              <dd>
                {p.phone ? (
                  <a href={`tel:${p.phone}`} className="text-primary tabular-nums hover:underline">
                    {p.phone}
                  </a>
                ) : (
                  "Non renseigné"
                )}
              </dd>
              {p.email && (
                <>
                  <dt className="text-muted">E-mail</dt>
                  <dd className="break-all">{p.email}</dd>
                </>
              )}
              <dt className="text-muted">Compte</dt>
              <dd className="break-all">
                {p.user ? (
                  <>
                    <span className="font-mono">{p.user.username}</span>
                    {!p.user.isActive && <span className="text-muted"> (désactivé)</span>}
                  </>
                ) : (
                  "Aucun compte"
                )}
              </dd>
              {p.user && (
                <>
                  <dt className="text-muted">Dernière connexion</dt>
                  <dd>{p.user.lastLoginAt ? formatDateTime(p.user.lastLoginAt) : "Jamais"}</dd>
                </>
              )}
            </>
          )}
        </Pairs>
        {!file.rights.contacts && (
          <p className="mt-4 flex items-center gap-1.5 text-sm text-muted">
            Coordonnées non affichées
            <InfoTip label="Pourquoi les coordonnées ne sont pas affichées">Le téléphone et le compte ne sont visibles que des profils qui gèrent les comptes utilisateurs.</InfoTip>
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function Schools({ file }: { file: TeacherFile }) {
  return (
    <Card aria-labelledby="file-schools">
      <Title id="file-schools" info="Nominations dans les établissements de votre périmètre. Une nomination hors de votre périmètre est comptée sans être nommée." label="À propos des établissements">
        Établissements
      </Title>
      {file.appointments.length === 0 && file.hiddenActive === 0 && (
        <EmptyState title="Pas encore nommé" description="Inscrit au registre, cet agent n'est nommé dans aucun établissement de votre périmètre." />
      )}
      <ul className="divide-y divide-border">
        {file.appointments.map((a) => {
          const chain = chainOfCycle(a.school.cycle);
          const payer = payerOf(a.status);
          return (
            <li key={a.id} className="flex flex-col gap-1.5 px-4 py-3 text-sm sm:px-5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Link href={`/espace/enseignants/${a.id}`} className="font-semibold text-primary hover:underline">
                  {a.school.name}
                </Link>
                <Badge tone={a.isActive ? "success" : "neutral"}>{a.isActive ? "En activité" : "Ancienne nomination"}</Badge>
              </div>
              <p className="text-muted">
                {a.school.commune.name}, {a.school.commune.department.name}
              </p>
              <p className="flex flex-wrap gap-1">
                <Badge tone="primary">
                  {CYCLE_LABELS[a.school.cycle]} · {MINISTRY_OF[chain].short}
                </Badge>
                <Badge>{SECTOR_LABELS[a.school.sector]}</Badge>
                {a.status && <Badge tone={isStateStatus(a.status) ? "primary" : "neutral"}>{TEACHER_STATUS_SHORT[a.status]}</Badge>}
              </p>
              <p className="text-xs text-muted">
                Matricule {a.matricule}
                {a.hiredAt ? ` · depuis le ${shortDate(a.hiredAt)}` : ""}
                {payer ? ` · payé par : ${payer === "STATE" ? "l'État" : "l'établissement"}` : ""}
              </p>
            </li>
          );
        })}
        {file.hiddenActive > 0 && (
          <li className="px-4 py-3 text-sm text-muted sm:px-5">
            {file.hiddenActive > 1 ? `Et ${file.hiddenActive} autres établissements` : "Et un autre établissement"}, hors de votre périmètre.
          </li>
        )}
      </ul>
    </Card>
  );
}

function CurrentYear({ file }: { file: TeacherFile }) {
  const title = file.year ? `Année ${file.year.label}` : "Année en cours";
  if (!file.current.length)
    return (
      <Card aria-labelledby="file-year">
        <Title id="file-year">{title}</Title>
        <EmptyState title="Aucun enseignement cette année" description="Aucune classe ne lui est attribuée dans vos établissements pour l'année en cours." />
      </Card>
    );
  return (
    <Card aria-labelledby="file-year">
      <Title id="file-year" info="Classes, matières et heures hebdomadaires attribuées par chaque établissement. Les élèves sont ceux inscrits dans la classe." label="À propos de l'année en cours">
        {title}
      </Title>
      <div className="divide-y divide-border">
        {file.current.map((c) => (
          <section key={c.teacherId} aria-label={c.school.name} className="py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 sm:px-5">
              <h3 className="font-semibold">{c.school.name}</h3>
              <p className="text-sm text-muted tabular-nums">
                {plural(c.hours, "heure")} · {plural(c.students, "élève")}
              </p>
            </div>
            {c.mainClasses.length > 0 && <p className="px-4 pt-1 text-sm text-muted sm:px-5">Professeur principal : {c.mainClasses.join(", ")}</p>}
            {file.rights.timetable && (
              <p className="px-4 pt-1 text-sm text-muted sm:px-5">
                Emploi du temps : {c.slots ? `${plural(c.slots, "créneau", "créneaux")} par semaine, ${weekDays(c.days)}` : "pas encore établi"}
              </p>
            )}
            {c.courses.length > 0 && (
              <Table density="compact" className="mt-2">
                <caption className="sr-only">Enseignements à {c.school.name}</caption>
                <THead>
                  <tr>
                    <TH>Classe</TH>
                    <TH>Matière</TH>
                    <TH className="text-right">H/sem.</TH>
                    <TH className="text-right max-sm:hidden">Élèves</TH>
                  </tr>
                </THead>
                <tbody>
                  {c.courses.map((x) => (
                    <TR key={x.id}>
                      <TD className="whitespace-nowrap">{x.classroom}</TD>
                      <TD>{x.subject}</TD>
                      <TD className="text-right tabular-nums">{x.weeklyHours}</TD>
                      <TD className="text-right tabular-nums max-sm:hidden">{x.students}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
          </section>
        ))}
      </div>
    </Card>
  );
}

function History({ file }: { file: TeacherFile }) {
  return (
    <Card aria-labelledby="file-history">
      <Title id="file-history" info="Toutes les années scolaires enregistrées, de la plus récente à la plus ancienne, dans les établissements de votre périmètre." label="À propos du parcours">
        Parcours par année
      </Title>
      {file.history.length === 0 ? (
        <EmptyState title="Aucune année enregistrée" description="Aucune classe ne lui a été attribuée dans vos établissements." />
      ) : (
        <ol className="divide-y divide-border">
          {file.history.map((y) => (
            <li key={y.year.id} className="px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold tabular-nums">
                  {y.year.label}
                  {y.year.isActive && (
                    <Badge tone="success" className="ml-2 align-middle">
                      En cours
                    </Badge>
                  )}
                </h3>
                {y.hours > 0 && <span className="text-sm text-muted tabular-nums">{plural(y.hours, "heure")} par semaine</span>}
              </div>
              <ul className="mt-1.5 flex flex-col gap-1 text-sm">
                {y.schools.map((s) => (
                  <li key={s.schoolId}>
                    <span className="font-medium">{s.schoolName}</span>
                    <span className="text-muted">
                      {" "}
                      · {s.classes.join(", ")}
                      {s.subjects.length ? ` · ${s.subjects.join(", ")}` : ""}
                      {s.mainClasses.length ? ` · professeur principal (${s.mainClasses.join(", ")})` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function Activity({ file }: { file: TeacherFile }) {
  const { sheets, registers, mockResults, absences, hasAccount } = file.activity;
  const rows: { label: string; value: string; hint?: string }[] = [];
  if (sheets) rows.push({ label: "Fiches de notes remplies", value: `${formatNumber(sheets.filled)} sur ${formatNumber(sheets.total)}`, hint: `${plural(sheets.locked, "verrouillée", "verrouillées")}` });
  if (registers !== null || (file.rights.attendance && !hasAccount)) rows.push({ label: "Appels faits", value: registers === null ? "–" : formatNumber(registers), hint: hasAccount ? undefined : "Sans compte, les appels sont faits par l'établissement" });
  if (mockResults !== null) rows.push({ label: "Résultats d'examens blancs saisis", value: formatNumber(mockResults) });
  if (absences !== null) rows.push({ label: "Absences de l'enseignant", value: plural(absences, "jour") });
  if (!rows.length) return null;
  return (
    <Card aria-labelledby="file-activity">
      <Title id="file-activity"
        info="Année en cours, dans vos établissements. Une fiche est remplie dès qu'elle compte une note. Un appel compte une classe pour une demi-journée. Les résultats et absences sont des nombres, sans détail."
        label="Comment ces indicateurs sont calculés"
      >
        Activité de l&apos;année
      </Title>
      <CardBody>
        <Pairs>
          {rows.map((r) => (
            <div key={r.label} className="contents">
              <dt className="text-muted">{r.label}</dt>
              <dd className="text-right">
                <span className="font-semibold tabular-nums">{r.value}</span>
                {r.hint && <span className="block text-xs text-muted">{r.hint}</span>}
              </dd>
            </div>
          ))}
        </Pairs>
      </CardBody>
    </Card>
  );
}

function Pay({ file }: { file: TeacherFile }) {
  const payers = file.appointments.filter((a) => a.isActive && a.status);
  const agent = file.profile.stateStatus;
  return (
    <Card aria-labelledby="file-pay">
      <Title id="file-pay"
        info="Les agents de l'État (APE, ACE, AME) sont payés par le ministère de l'Économie et des Finances, sur leur matricule de l'État. Les vacataires et les enseignants du privé sont payés par l'établissement, qui garde les montants."
        label="À propos de la rémunération"
      >
        Rémunération
      </Title>
      <CardBody>
        {payers.length ? (
          <ul className="flex flex-col gap-2 text-sm">
            {payers.map((a) => (
              <li key={a.id}>
                <span className="font-medium">{a.school.name}</span>
                <span className="block text-muted">
                  {TEACHER_STATUS_LABELS[a.status!]}, payé par : {PAYER_LABELS[payerOf(a.status)!]}
                </span>
              </li>
            ))}
          </ul>
        ) : agent ? (
          <p className="text-sm">
            {TEACHER_STATUS_LABELS[agent]}, payé par : {PAYER_LABELS.STATE}
          </p>
        ) : (
          <p className="text-sm text-muted">Statut non renseigné.</p>
        )}
      </CardBody>
    </Card>
  );
}

function Registry({ file }: { file: TeacherFile }) {
  const p = file.profile;
  if (!p.stateStatus && !file.journal.length) return null;
  return (
    <Card aria-labelledby="file-registry">
      <Title id="file-registry" info="Le ministère tient le registre des agents de l'État ; les établissements les y trouvent pour les nommer." label="À propos du registre de l'État">
        Registre de l&apos;État
      </Title>
      <CardBody>
        <Pairs>
          <dt className="text-muted">Statut</dt>
          <dd>{p.stateStatus ? TEACHER_STATUS_LABELS[p.stateStatus] : "Pas agent de l'État"}</dd>
          {p.stateStatus && (
            <>
              <dt className="text-muted">Matricule de l&apos;État</dt>
              <dd className="tabular-nums">{p.stateMatricule ?? "Non renseigné"}</dd>
            </>
          )}
        </Pairs>
        {file.journal.length > 0 && (
          <ol className="mt-4 flex flex-col gap-2 border-t border-border pt-3 text-sm">
            {file.journal.map((j) => (
              <li key={j.id}>
                <span className="font-medium">{j.what}</span>
                <span className="block text-muted">
                  {formatDateTime(j.at)}
                  {j.by ? `, par ${j.by}` : ""}
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}
