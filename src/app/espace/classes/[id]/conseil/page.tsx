import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { PageHeader } from "@/components/kit/page-header";
import { EmptyState } from "@/components/kit/states";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { saveCouncilDecisions } from "@/features/council/actions";
import { classCouncil } from "@/features/council/queries";
import { can, requirePermission } from "@/lib/auth/authorize";
import { COUNCIL_DECISION_LABELS, COUNCIL_DECISION_TONES, COUNCIL_DECISIONS } from "@/lib/domain/council";
import { YEARLY_RULE } from "@/lib/domain/periodicity";
import { formatAverage } from "@/lib/utils";

export const metadata: Metadata = { title: "Conseil de classe" };

// End of year decisions of a class: the yearly average of each pupil, the
// proposal of the rules (article 60 and 62 of order n° 029 of 2024), and the
// decision the council takes.
export default async function CouncilPage(props: PageProps<"/espace/classes/[id]/conseil">) {
  const user = await requirePermission("report_card:view");
  const { id } = await props.params;
  const sheet = await classCouncil(user, id);
  if (!sheet) notFound();
  const { classroom, pupils } = sheet;
  const canDecide = can(user, "report_card:publish") && user.scope.level === "SCHOOL";

  const rows = pupils.map((p) => (
    <TR key={p.enrollmentId}>
      <TD data-label="Élève">
        <span className="font-semibold">
          {p.student.lastName} {p.student.firstName}
        </span>
        <span className="block font-mono text-xs text-muted">{p.student.matricule}</span>
      </TD>
      <TD data-label="Moyenne annuelle" className="text-right tabular-nums">
        {p.yearlyAverage === null ? "–" : formatAverage(p.yearlyAverage)}
      </TD>
      <TD data-label="Proposition">{p.proposal ? COUNCIL_DECISION_LABELS[p.proposal] : "–"}</TD>
      <TD data-label="Décision">
        {canDecide ? (
          <>
            <input type="hidden" name="enrollmentId[]" value={p.enrollmentId} />
            <Select name="decision[]" defaultValue={p.decision?.decision ?? ""} aria-label={`Décision pour ${p.student.firstName} ${p.student.lastName}`}>
              <option value="">Non décidé</option>
              {COUNCIL_DECISIONS.map((d) => (
                <option key={d} value={d}>
                  {COUNCIL_DECISION_LABELS[d]}
                </option>
              ))}
            </Select>
          </>
        ) : p.decision ? (
          <Badge tone={COUNCIL_DECISION_TONES[p.decision.decision]}>{COUNCIL_DECISION_LABELS[p.decision.decision]}</Badge>
        ) : (
          <span className="text-sm text-muted">Non décidé</span>
        )}
      </TD>
      <TD data-label="Observation">
        {canDecide ? (
          <Input name="note[]" defaultValue={p.decision?.note ?? ""} maxLength={300} aria-label={`Observation pour ${p.student.firstName} ${p.student.lastName}`} />
        ) : (
          <span className="text-sm">{p.decision?.note ?? ""}</span>
        )}
      </TD>
    </TR>
  ));

  const table = (
    <Table cards>
      <caption className="sr-only">Décisions de fin d&apos;année de la {classroom.name}</caption>
      <THead>
        <TR>
          <TH>Élève</TH>
          <TH className="text-right">Moyenne annuelle</TH>
          <TH>Proposition</TH>
          <TH>Décision</TH>
          <TH>Observation</TH>
        </TR>
      </THead>
      <tbody>{rows}</tbody>
    </Table>
  );

  return (
    <>
      <nav aria-label="Fil d'Ariane" className="mb-2 text-sm text-muted max-lg:hidden">
        <Link href="/espace/classes" className="hover:underline">
          Classes
        </Link>{" "}
        /{" "}
        <Link href={`/espace/classes/${classroom.id}`} className="hover:underline">
          {classroom.name}
        </Link>{" "}
        / Conseil de classe
      </nav>
      <PageHeader
        title={`Conseil de classe, ${classroom.name}`}
        description={`Décisions de fin d'année ${classroom.academicYear.label}`}
        info={`Moyenne annuelle : ${YEARLY_RULE[classroom.school.periodicity]}.`}
      />
      <Alert tone="info" className="mb-4">
        Proposition selon l&apos;arrêté n° 029 du 6 mai 2024 : passage à partir de 10/20 de moyenne annuelle, redoublement en dessous. Au primaire, le passage est de droit
        en CI, CE1 et CM1. L&apos;exclusion n&apos;est jamais proposée : le conseil la décide et la motive.
      </Alert>
      {pupils.length === 0 ? (
        <Card>
          <EmptyState title="Aucun élève inscrit" />
        </Card>
      ) : canDecide ? (
        <ActionForm action={saveCouncilDecisions} className="flex flex-col gap-4">
          <input type="hidden" name="classroomId" value={classroom.id} />
          <Card>{table}</Card>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Enregistrement…">Enregistrer les décisions</SubmitButton>
          </div>
        </ActionForm>
      ) : (
        <Card>{table}</Card>
      )}
    </>
  );
}
