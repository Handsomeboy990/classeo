import { ArrowLeft, Award, CheckCircle2, ClipboardList, PenLine, Percent, School, Send, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmButton } from "@/components/kit/confirm-button";
import { AverageLevel } from "@/components/kit/level";
import { PageHeader } from "@/components/kit/page-header";
import { StatCard, StatGrid } from "@/components/kit/stat-card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { closeExam, submitExam } from "@/features/mock-exams/actions";
import { DecideForm, InviteDialog, RespondForm } from "@/features/mock-exams/components/decision-forms";
import { candidateSchools, examResults, examTimeline, familyResults, getExam, writableClassrooms, type ExamDetail, type ExamResults } from "@/features/mock-exams/queries";
import {
  APPROVER_LABELS,
  approvalLevel,
  canDecideAt,
  canRespond,
  canSubmit,
  ORGANIZER_LABELS,
  PARTICIPATION_LABELS,
  PARTICIPATION_TONES,
  resultsOpen,
  STATUS_LABELS,
  STATUS_TONES,
  type Participation,
} from "@/features/mock-exams/rules";
import { can, requirePermission } from "@/lib/auth/authorize";
import { isTeacherRole } from "@/lib/auth/scope";
import { formatRank } from "@/lib/domain/report-card";
import { PdfDownloadLink } from "@/lib/pdf/download-link";
import { formatAverage, formatDate, formatDateTime, formatNumber, formatPercent, plural } from "@/lib/utils";

export const metadata: Metadata = { title: "Examen blanc" };

const NAMED_LIMIT = 100;

export default async function MockExamPage({ params }: PageProps<"/espace/examens-blancs/[id]">) {
  const user = await requirePermission("mock_exam:view");
  const { id } = await params;
  const exam = await getExam(user, id);
  if (!exam) notFound();

  const family = user.scope.level === "SELF";
  const running = exam.status === "APPROVED" || exam.status === "CLOSED";
  const schoolId = user.scope.level === "SCHOOL" ? user.scope.schoolId : null;
  const mine = schoolId ? exam.participants.find((p) => p.schoolId === schoolId) : undefined;
  const head = !!schoolId && !isTeacherRole(user);
  const organizerHead = exam.viewerIsOrganizer && head && can(user, "mock_exam:create");
  const territoryOrganizer = exam.viewerIsOrganizer && !schoolId && can(user, "mock_exam:create");
  const approvalSchools = exam.participants.filter((p) => p.status !== "DECLINED").map((p) => ({ communeId: p.school.communeId, departmentId: p.school.commune.departmentId }));
  const required = exam.organizerLevel === "SCHOOL" ? approvalLevel(approvalSchools) : null;
  const partnerCount = exam.participants.filter((p) => !p.isOrganizer && p.status !== "DECLINED").length;

  const canAnswer = head && can(user, "mock_exam:approve") && !!mine && canRespond(exam, mine.status as Participation);
  const canDecide = exam.status === "PENDING_APPROVAL" && !!required && can(user, "mock_exam:approve") && canDecideAt(user.scope, required, approvalSchools);
  const submittable = organizerHead && canSubmit(exam, exam.participants.map((p) => ({ status: p.status as Participation, isOrganizer: p.isOrganizer })));
  const inviting = organizerHead && (exam.status === "DRAFT" || exam.status === "REJECTED");
  const closable = (organizerHead || territoryOrganizer) && exam.status === "APPROVED";

  const [results, timeline, rooms, partners] = await Promise.all([
    running ? examResults(user, exam) : null,
    family ? [] : examTimeline(exam.id),
    resultsOpen(exam) ? writableClassrooms(user, exam) : [],
    inviting ? candidateSchools(user, exam.academicYearId, [exam.levelId]) : [],
  ]);
  const children = family && results ? await familyResults(user, exam, results) : [];
  const home = exam.participants.find((p) => p.isOrganizer)?.school;

  const dates = exam.startDate.getTime() === exam.endDate.getTime() ? `le ${formatDate(exam.startDate)}` : `du ${formatDate(exam.startDate)} au ${formatDate(exam.endDate)}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={exam.title}
        description={`${exam.level?.name ?? ""} · épreuves ${dates} · ${exam.organizerName}`}
        actions={
          <>
            <Badge tone={STATUS_TONES[exam.status]} className="h-8 px-3 text-sm">
              {STATUS_LABELS[exam.status]}
            </Badge>
            {running && can(user, "mock_exam:export") && <PdfDownloadLink href={`/api/pdf/examens-blancs/${exam.id}`} label="Relevé des résultats" />}
            <ButtonLink href="/espace/examens-blancs" variant="secondary" className="max-lg:hidden">
              <ArrowLeft aria-hidden /> Tous les examens
            </ButtonLink>
          </>
        }
      />

      {exam.status === "REJECTED" && exam.decisionNote && (
        <Alert tone="danger" title={`Refusé${exam.decidedAt ? ` le ${formatDateTime(exam.decidedAt)}` : ""}${exam.decidedBy ? ` par ${exam.decidedBy.name}, ${exam.decidedBy.role}` : ""}`}>
          <p className="mt-1 whitespace-pre-line">{exam.decisionNote}</p>
          {organizerHead && <p className="mt-2">Vous pouvez inviter d&apos;autres établissements puis soumettre à nouveau l&apos;examen.</p>}
        </Alert>
      )}
      {exam.status === "APPROVED" && exam.organizerLevel === "SCHOOL" && exam.decisionNote && (
        <Alert tone="success" title={`Validé${exam.decidedAt ? ` le ${formatDateTime(exam.decidedAt)}` : ""}${exam.decidedBy ? ` par ${exam.decidedBy.name}, ${exam.decidedBy.role}` : ""}`}>
          <p className="mt-1 whitespace-pre-line">{exam.decisionNote}</p>
        </Alert>
      )}
      {mine?.status === "IMPOSED" && !family && <Alert tone="info">La participation de votre établissement est imposée par {exam.organizerName}.</Alert>}

      {canAnswer && (
        <Card>
          <CardHeader>
            <CardTitle>Votre établissement est invité</CardTitle>
            <CardDescription>{exam.organizerName} vous propose de participer à cet examen blanc. Votre réponse est définitive.</CardDescription>
          </CardHeader>
          <CardBody>
            <RespondForm examId={exam.id} />
          </CardBody>
        </Card>
      )}

      {canDecide && (
        <Card>
          <CardHeader>
            <CardTitle>Validation</CardTitle>
            <CardDescription>
              Examen proposé par {exam.organizerName} avec {plural(partnerCount, "établissement partenaire", "établissements partenaires")} (acceptés ou sans réponse). Il relève de{" "}
              {APPROVER_LABELS[required!]}.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <DecideForm examId={exam.id} />
          </CardBody>
        </Card>
      )}

      {(inviting || closable) && (
        <Card>
          <CardHeader>
            <CardTitle>Organisation</CardTitle>
            <CardDescription>
              {inviting
                ? submittable
                  ? `Au moins un partenaire a accepté : soumettez l'examen à ${APPROVER_LABELS[required ?? "COMMUNE"]}.`
                  : "L'examen pourra être soumis à la validation dès qu'un établissement invité aura accepté."
                : "Clôturez l'examen quand toutes les notes sont saisies : les résultats deviennent définitifs et les familles sont notifiées."}
            </CardDescription>
          </CardHeader>
          <CardBody className="flex flex-wrap gap-2">
            {inviting && home && (
              <InviteDialog
                examId={exam.id}
                levelId={exam.levelId}
                schools={partners}
                exclude={exam.participants.map((p) => p.schoolId)}
                home={{ communeId: home.communeId, communeName: home.commune.name, departmentName: home.commune.department.name }}
              />
            )}
            {inviting && submittable && (
              <ConfirmButton
                action={submitExam}
                fields={{ examId: exam.id }}
                title="Soumettre l'examen à la validation ?"
                description={`L'examen part à ${APPROVER_LABELS[required ?? "COMMUNE"]}. Les invitations restées sans réponse pourront encore être acceptées jusqu'au début des épreuves.`}
                confirmLabel="Soumettre"
                tone="primary"
                variant="primary"
              >
                <Send aria-hidden /> Soumettre à la validation
              </ConfirmButton>
            )}
            {closable && (
              <ConfirmButton
                action={closeExam}
                fields={{ examId: exam.id }}
                title="Clôturer l'examen blanc ?"
                description="Les notes ne pourront plus être modifiées. Les établissements et les familles sont notifiés des résultats définitifs."
                confirmLabel="Clôturer"
                tone="primary"
                variant="secondary"
              >
                <CheckCircle2 aria-hidden /> Clôturer et publier les résultats
              </ConfirmButton>
            )}
          </CardBody>
        </Card>
      )}

      {rooms.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Saisie des notes</CardTitle>
            <CardDescription>Notes sur 20 de vos classes, matière par matière.</CardDescription>
          </CardHeader>
          <CardBody className="flex flex-wrap gap-2">
            {rooms.map((r) => (
              <ButtonLink key={r.id} href={`/espace/examens-blancs/${exam.id}/saisie?classe=${r.id}`} variant="soft">
                <PenLine aria-hidden /> {r.name} ({plural(r.subjects.length, "matière")})
              </ButtonLink>
            ))}
          </CardBody>
        </Card>
      )}

      {family && <FamilyResults exam={exam} items={children} results={results} />}

      <div className="grid grid-cols-1 gap-6 *:min-w-0 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Info label="Classe d'examen" value={exam.level?.name ?? ""} />
              <Info label="Année scolaire" value={exam.academicYear.label} />
              <Info label="Organisateur" value={`${exam.organizerName} (${ORGANIZER_LABELS[exam.organizerLevel]})`} />
              <Info label="Épreuves" value={dates} />
              <Info label="Participation" value={exam.organizerLevel === "SCHOOL" ? "Sur invitation, acceptée par chaque établissement" : "Imposée aux établissements concernés"} />
              <Info label="Validation" value={required ? `Par ${APPROVER_LABELS[required]}` : "Décidé par l'autorité, sans autre validation"} />
              <div className="sm:col-span-2">
                <dt className="text-sm text-muted">Matières</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {exam.subjectList.map((s) => (
                    <Badge key={s.code}>{s.name}</Badge>
                  ))}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>
        {!family && <Timeline items={timeline} />}
      </div>

      {!family && <Participants exam={exam} results={results} />}
      {!family && results && <Consolidated exam={exam} results={results} />}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

const STEP_LABELS: Record<string, string> = {
  create: "Création",
  invite: "Invitation",
  accept: "Invitation acceptée",
  decline: "Invitation déclinée",
  submit: "Soumission",
  approve: "Validation",
  reject: "Refus",
  close: "Clôture",
};

function Timeline({ items }: { items: Awaited<ReturnType<typeof examTimeline>> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique</CardTitle>
      </CardHeader>
      <CardBody>
        {items.length === 0 ? (
          <p className="text-sm text-muted">Aucune étape enregistrée.</p>
        ) : (
          <ol className="flex flex-col gap-4 border-l-2 border-border pl-4">
            {items.map((t) => (
              <li key={t.id} className="relative">
                <span className="absolute top-1.5 -left-[1.4rem] size-2.5 rounded-full bg-primary" aria-hidden />
                <p className="text-sm font-semibold">{STEP_LABELS[t.step]}</p>
                <p className="text-sm text-pretty">{t.summary}</p>
                <p className="text-xs text-muted">
                  {formatDateTime(t.createdAt)}
                  {t.user ? `, ${t.user.firstName} ${t.user.lastName} (${t.user.role.name})` : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}

function Participants({ exam, results }: { exam: ExamDetail; results: ExamResults | null }) {
  const bySchool = new Map(results?.schools.map((s) => [s.schoolId, s]) ?? []);
  const counts = exam.participants.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.status]: (acc[p.status] ?? 0) + 1 }), {});
  return (
    <Card>
      <CardHeader>
        <CardTitle>Établissements</CardTitle>
        <CardDescription>
          {(Object.keys(PARTICIPATION_LABELS) as Participation[])
            .filter((s) => counts[s])
            .map((s) => `${PARTICIPATION_LABELS[s]} : ${formatNumber(counts[s]!)}`)
            .join(" · ")}
        </CardDescription>
      </CardHeader>
      <Table cards>
        <caption className="sr-only">Établissements invités ou concernés et leur réponse</caption>
        <THead>
          <TR>
            <TH>Établissement</TH>
            <TH>Commune</TH>
            <TH>Participation</TH>
            <TH>Réponse</TH>
            {results && <TH className="text-right">Candidats</TH>}
          </TR>
        </THead>
        <tbody>
          {exam.participants.map((p) => (
            <TR key={p.id}>
              <TD data-label="Établissement" className="font-semibold">
                {p.school.name}
                {p.isOrganizer && (
                  <Badge tone="accent" className="ml-2">
                    Organisateur
                  </Badge>
                )}
              </TD>
              <TD data-label="Commune">
                {p.school.commune.name}, {p.school.commune.department.name}
              </TD>
              <TD data-label="Participation">
                <Badge tone={PARTICIPATION_TONES[p.status]}>{p.isOrganizer ? "Organisateur" : PARTICIPATION_LABELS[p.status]}</Badge>
              </TD>
              <TD data-label="Réponse" className="text-sm text-muted">
                {p.respondedAt ? `${formatDateTime(p.respondedAt)}${p.respondedBy ? `, ${p.respondedBy.name}` : ""}` : p.status === "IMPOSED" ? "Sans objet" : "En attente"}
              </TD>
              {results && (
                <TD data-label="Candidats" className="text-right tabular-nums">
                  {bySchool.has(p.schoolId) ? formatNumber(bySchool.get(p.schoolId)!.candidates) : "–"}
                </TD>
              )}
            </TR>
          ))}
        </tbody>
      </Table>
      {exam.organizerLevel === "SCHOOL" && !exam.participants.some((p) => p.isOrganizer) && (
        <CardBody>
          <p className="text-sm text-muted">L&apos;établissement organisateur n&apos;a pas de classe de ce niveau : il coordonne l&apos;examen sans présenter de candidats.</p>
        </CardBody>
      )}
    </Card>
  );
}

function Consolidated({ exam, results }: { exam: ExamDetail; results: ExamResults }) {
  const o = results.overall;
  const shown = results.named.slice(0, NAMED_LIMIT);
  return (
    <>
      <StatGrid>
        <StatCard label="Candidats" value={formatNumber(o.candidates)} icon={Users} />
        <StatCard label="Résultats complets" value={formatNumber(o.complete)} icon={ClipboardList} tone="info" />
        <StatCard label="Moyenne générale" value={o.average === null ? "–" : `${formatAverage(o.average)}/20`} icon={Award} tone="accent" />
        <StatCard label="Moyenne atteinte (10/20)" value={formatPercent(o.passRate)} icon={Percent} tone="warning" />
      </StatGrid>
      <div className="grid grid-cols-1 gap-6 *:min-w-0 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Classement des établissements</CardTitle>
          </CardHeader>
          <Table cards>
            <caption className="sr-only">Classement des établissements par moyenne</caption>
            <THead>
              <TR>
                <TH>Rang</TH>
                <TH>Établissement</TH>
                <TH>Moyenne</TH>
                <TH className="text-right">Moyenne atteinte</TH>
              </TR>
            </THead>
            <tbody>
              {results.schools.map((s) => (
                <TR key={s.schoolId}>
                  <TD data-label="Rang" className="font-semibold tabular-nums">
                    {formatRank(s.rank, s.tied)}
                  </TD>
                  <TD data-label="Établissement">
                    <School className="mr-1 inline size-4 text-muted" aria-hidden />
                    {s.name}
                    <span className="block text-xs text-muted">
                      {plural(s.complete, "résultat complet", "résultats complets")} sur {formatNumber(s.candidates)}
                    </span>
                  </TD>
                  <TD data-label="Moyenne">
                    <AverageLevel average={s.average} />
                  </TD>
                  <TD data-label="Moyenne atteinte" className="text-right tabular-nums">
                    {formatPercent(s.passRate)}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Moyennes par matière</CardTitle>
          </CardHeader>
          <Table cards>
            <caption className="sr-only">Moyenne de chaque matière, tous établissements confondus</caption>
            <THead>
              <TR>
                <TH>Matière</TH>
                <TH>Moyenne</TH>
              </TR>
            </THead>
            <tbody>
              {exam.subjectList.map((s) => (
                <TR key={s.code}>
                  <TD data-label="Matière">{s.name}</TD>
                  <TD data-label="Moyenne">
                    <AverageLevel average={results.subjectAverages[s.code] ?? null} />
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Classement des candidats</CardTitle>
          <CardDescription>
            {results.named.length === 0
              ? "Aucun candidat de votre périmètre."
              : `${plural(results.named.length, "candidat")} de votre périmètre${results.named.length > NAMED_LIMIT ? `, les ${NAMED_LIMIT} premiers affichés ; le relevé PDF contient la liste complète` : ""}. Seuls les candidats ayant toutes leurs notes sont classés.${exam.status === "APPROVED" ? " Classement provisoire jusqu'à la clôture." : ""}`}
          </CardDescription>
        </CardHeader>
        {shown.length > 0 && (
          <Table cards density="compact">
            <caption className="sr-only">Classement des candidats</caption>
            <THead>
              <TR>
                <TH>Rang général</TH>
                <TH>Candidat</TH>
                <TH>Classe</TH>
                {exam.subjectList.map((s) => (
                  <TH key={s.code} className="text-center" title={s.name}>
                    {s.code}
                  </TH>
                ))}
                <TH>Moyenne</TH>
                <TH className="text-right">Rang établissement</TH>
              </TR>
            </THead>
            <tbody>
              {shown.map((r) => (
                <TR key={r.enrollmentId}>
                  <TD data-label="Rang général" className="font-semibold tabular-nums">
                    {formatRank(r.overallRank, r.overallTied)}
                  </TD>
                  <TD data-label="Candidat">
                    <Link href={`/espace/eleves/${r.studentId}`} className="hover:underline">
                      {r.name}
                    </Link>
                  </TD>
                  <TD data-label="Classe">{r.classroomName}</TD>
                  {exam.subjectList.map((s) => (
                    <TD key={s.code} data-label={s.name} className="text-center tabular-nums">
                      {formatAverage(r.scores[s.code] ?? null)}
                    </TD>
                  ))}
                  <TD data-label="Moyenne" className="font-semibold tabular-nums">
                    {formatAverage(r.average)}
                  </TD>
                  <TD data-label="Rang établissement" className="text-right tabular-nums">
                    {formatRank(r.schoolRank, r.schoolTied)}
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

function FamilyResults({ exam, items, results }: { exam: ExamDetail; items: Awaited<ReturnType<typeof familyResults>>; results: ExamResults | null }) {
  if (!items.length) return <Alert tone="info">Aucun de vos enfants n&apos;est candidat à cet examen.</Alert>;
  return (
    <>
      {items.map((c) => (
        <Card key={c.enrollmentId}>
          <CardHeader>
            <CardTitle>
              {c.name}, {c.classroom}
            </CardTitle>
            {c.result && (
              <p className="text-sm">
                Rang dans l&apos;établissement : <strong>{formatRank(c.result.schoolRank, c.result.schoolTied)}</strong> · Rang général :{" "}
                <strong>{formatRank(c.result.overallRank, c.result.overallTied)}</strong> sur {plural(results?.overall.complete ?? 0, "candidat classé", "candidats classés")}
              </p>
            )}
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            {!c.result || c.result.average === null ? (
              <p className="text-muted">Les notes ne sont pas encore saisies.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-muted">Moyenne :</span>
                  <AverageLevel average={c.result.average} size="lg" />
                  {exam.status === "APPROVED" && <Badge tone="warning">Résultats provisoires</Badge>}
                </div>
                <Table cards>
                  <caption className="sr-only">Notes de {c.name} par matière</caption>
                  <THead>
                    <TR>
                      <TH>Matière</TH>
                      <TH>Note</TH>
                      <TH className="text-right">Moyenne de tous les candidats</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {exam.subjectList.map((s) => (
                      <TR key={s.code}>
                        <TD data-label="Matière">{s.name}</TD>
                        <TD data-label="Note">
                          <AverageLevel average={c.result!.scores[s.code] ?? null} />
                        </TD>
                        <TD data-label="Moyenne de tous les candidats" className="text-right tabular-nums">
                          {formatAverage(results?.subjectAverages[s.code] ?? null)}
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </>
            )}
          </CardBody>
        </Card>
      ))}
    </>
  );
}
