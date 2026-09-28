import { View } from "@react-pdf/renderer";

import { CYCLE_LABELS, SECTOR_LABELS } from "@/features/schools/labels";
import type { TeacherFile } from "@/features/teachers/file";
import { weekDays } from "@/features/teachers/file-rules";
import { chainOfCycle, MINISTRY_OF } from "@/lib/domain/chains";
import { PAYER_LABELS, payerOf, TEACHER_STATUS_LABELS } from "@/lib/domain/teacher-status";

import { DataTable, Figure, FigureRow, InfoGrid, SectionTitle } from "../components";
import { beninDateTime, calendarDate, officialName } from "../format";
import { DocumentPage, PdfDocument, T, type DocumentMeta } from "../layout";
import { styles } from "../styles";
import { COLORS } from "../theme";

// Fiche enseignant: the teacher file page on paper, for the ministry, a
// department or a circonscription. The same rules as the page: only the
// schools of the viewer's scope, contacts only for the accounts allowed to
// see them, no amount of pay.

const GENDER = { F: "Femme", M: "Homme" } as const;

function TeacherFileDoc({ file, meta }: { file: TeacherFile; meta: DocumentMeta }) {
  const p = file.profile;
  const totals = file.current.reduce((t, c) => ({ hours: t.hours + c.hours, classes: t.classes + c.classes, students: t.students + c.students }), { hours: 0, classes: 0, students: 0 });
  const status = p.stateStatus ?? file.appointments.find((a) => a.isActive && a.status)?.status ?? null;
  type Appointment = TeacherFile["appointments"][number];
  type Course = TeacherFile["current"][number]["courses"][number] & { school: string };
  const courses: Course[] = file.current.flatMap((c) => c.courses.map((x) => ({ ...x, school: c.school.name })));
  const a = file.activity;

  return (
    <DocumentPage meta={meta}>
      <View style={{ marginBottom: 8 }}>
        <T style={{ fontSize: 15, fontWeight: 700, color: COLORS.primaryDark }}>{officialName(p.lastName, p.firstName)}</T>
      </View>
      <InfoGrid
        columns={3}
        items={[
          { label: "Sexe", value: p.gender ? GENDER[p.gender] : "Non renseigné" },
          { label: "NPI", value: p.npi ?? "Non renseigné" },
          { label: "Spécialité", value: file.specialty ?? "Non renseignée" },
          { label: "Statut", value: status ? TEACHER_STATUS_LABELS[status] : "Non renseigné" },
          { label: "Matricule de l'État", value: p.stateMatricule ?? "Sans objet" },
          { label: "Au registre depuis", value: calendarDate(p.createdAt) },
          ...(file.rights.contacts
            ? [
                { label: "Téléphone", value: p.phone ?? "Non renseigné" },
                { label: "Compte", value: p.user ? p.user.username : "Aucun compte" },
                { label: "Dernière connexion", value: p.user?.lastLoginAt ? beninDateTime(p.user.lastLoginAt) : "Jamais" },
              ]
            : []),
        ]}
      />

      <View style={{ marginTop: 10 }}>
        <FigureRow>
          <Figure label="Établissements" value={String(file.appointments.filter((x) => x.isActive).length)} compact tone="primary" />
          <Figure label="Classes" value={String(totals.classes)} compact />
          <Figure label="Heures par semaine" value={String(totals.hours)} compact />
          <Figure label="Élèves suivis" value={String(totals.students)} compact />
        </FigureRow>
      </View>

      <View style={{ marginTop: 10 }}>
        <SectionTitle>Établissements</SectionTitle>
        <DataTable
          dense
          fontSize={8.5}
          columns={[
            { header: "Établissement", flex: 2.4, render: (r: Appointment) => r.school.name },
            { header: "Commune, département", flex: 2, render: (r: Appointment) => `${r.school.commune.name}, ${r.school.commune.department.name}` },
            { header: "Ordre", flex: 1.5, render: (r: Appointment) => `${CYCLE_LABELS[r.school.cycle]} (${MINISTRY_OF[chainOfCycle(r.school.cycle)].short})` },
            { header: "Secteur", flex: 1.3, render: (r: Appointment) => SECTOR_LABELS[r.school.sector] },
            { header: "Payé par", flex: 1.2, render: (r: Appointment) => (payerOf(r.status) ? (payerOf(r.status) === "STATE" ? "État" : "Établissement") : "–") },
            { header: "Situation", flex: 1.1, render: (r: Appointment) => (r.isActive ? "En activité" : "Ancienne") },
          ]}
          rows={file.appointments}
          empty="Nommé dans aucun établissement du périmètre."
        />
        {file.hiddenActive > 0 ? (
          <T style={[styles.small, styles.muted, { marginTop: 3 }]}>
            {file.hiddenActive > 1 ? `Et ${file.hiddenActive} autres établissements` : "Et un autre établissement"}, hors du périmètre de l&apos;émetteur.
          </T>
        ) : null}
      </View>

      <View style={{ marginTop: 10 }}>
        <SectionTitle>{file.year ? `Enseignements ${file.year.label}` : "Enseignements de l'année"}</SectionTitle>
        <DataTable
          dense
          fontSize={8.5}
          columns={[
            { header: "Établissement", flex: 2.4, render: (r: Course) => r.school },
            { header: "Classe", flex: 1, render: (r: Course) => r.classroom },
            { header: "Matière", flex: 2, render: (r: Course) => r.subject },
            { header: "H/sem.", width: 44, align: "right", render: (r: Course) => String(r.weeklyHours) },
            { header: "Élèves", width: 44, align: "right", render: (r: Course) => String(r.students) },
          ]}
          rows={courses}
          footer={courses.length ? ["Total", "", "", String(totals.hours), String(totals.students)] : undefined}
          empty="Aucune classe attribuée cette année."
        />
        {file.rights.timetable
          ? file.current.map((c) => (
              <T key={c.teacherId} style={[styles.small, styles.muted, { marginTop: 2 }]}>
                {c.school.name} : {c.slots ? `emploi du temps de ${c.slots} créneau${c.slots > 1 ? "x" : ""} par semaine, ${weekDays(c.days)}` : "emploi du temps pas encore établi"}
                {c.mainClasses.length ? `, professeur principal de ${c.mainClasses.join(", ")}` : ""}.
              </T>
            ))
          : null}
      </View>

      <View style={{ marginTop: 10 }}>
        <SectionTitle>Parcours par année scolaire</SectionTitle>
        <DataTable
          dense
          fontSize={8.5}
          columns={[
            { header: "Année", width: 64, render: (r: Row) => r.year },
            { header: "Établissement", flex: 2, render: (r: Row) => r.school },
            { header: "Classes", flex: 2.6, render: (r: Row) => r.classes },
            { header: "H/sem.", width: 44, align: "right", render: (r: Row) => r.hours },
          ]}
          rows={file.history.flatMap((y) => y.schools.map((s) => ({ year: y.year.label, school: s.schoolName, classes: s.classes.join(", "), hours: s.hours ? String(s.hours) : "–" })))}
          empty="Aucune année enregistrée dans le périmètre."
        />
      </View>

      {a.sheets || a.registers !== null || a.mockResults !== null || a.absences !== null ? (
        <View style={{ marginTop: 10 }} wrap={false}>
          <SectionTitle>Activité de l&apos;année</SectionTitle>
          <InfoGrid
            columns={4}
            items={[
              ...(a.sheets ? [{ label: "Fiches de notes remplies", value: `${a.sheets.filled} sur ${a.sheets.total}, ${a.sheets.locked} verrouillée${a.sheets.locked > 1 ? "s" : ""}` }] : []),
              ...(a.registers !== null ? [{ label: "Appels faits", value: String(a.registers) }] : []),
              ...(a.mockResults !== null ? [{ label: "Résultats d'examens blancs", value: String(a.mockResults) }] : []),
              ...(a.absences !== null ? [{ label: "Absences de l'enseignant", value: `${a.absences} jour${a.absences > 1 ? "s" : ""}` }] : []),
            ]}
          />
        </View>
      ) : null}

      <T style={{ marginTop: 10, fontSize: 7, color: COLORS.muted }}>
        Rémunération : {status ? `${TEACHER_STATUS_LABELS[status]}, payé par : ${PAYER_LABELS[payerOf(status)!]}` : "statut non renseigné"}. Les agents de l&apos;État sont payés par le
        ministère de l&apos;Économie et des Finances ; les montants versés par un établissement restent à l&apos;établissement. Fiche limitée aux établissements du périmètre de
        l&apos;émetteur.
      </T>
    </DocumentPage>
  );
}

type Row = { year: string; school: string; classes: string; hours: string };

export const teacherFilePdf = (file: TeacherFile, meta: DocumentMeta) => (
  <PdfDocument title={`Fiche enseignant, ${file.profile.lastName} ${file.profile.firstName}`} author={meta.issuer.name}>
    <TeacherFileDoc file={file} meta={meta} />
  </PdfDocument>
);
