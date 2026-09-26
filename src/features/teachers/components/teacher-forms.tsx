import { Pencil } from "lucide-react";

import { FormDialog } from "@/components/kit/form-dialog";
import { FormField } from "@/components/kit/form-field";
import { Input, Select, Switch } from "@/components/ui/input";

import { isStateStatus, TEACHER_STATUS_LABELS, type TeacherStatus } from "@/lib/domain/teacher-status";

import { updateTeacher } from "../actions";

export type TeacherValues = {
  id: string;
  lastName: string;
  firstName: string;
  gender: "F" | "M" | null;
  phone: string | null;
  specialty: string | null;
  hiredAt: string | null;
  isActive: boolean;
  npi: string | null;
  status: TeacherStatus | null;
  // Status recorded by the ministry for an agent of the State.
  stateStatus: TeacherStatus | null;
};

// statusOptions: the statuses the school may give (a public school hires
// vacataires, a private school its own teachers too). An agent of the State
// keeps the status of the ministry registry.
export function TeacherFields({ values, statusOptions }: { values?: TeacherValues; statusOptions: TeacherStatus[] }) {
  const fromRegistry = isStateStatus(values?.status) && values?.status === values?.stateStatus;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {values && <input type="hidden" name="id" value={values.id} />}
      <FormField label="Nom" name="lastName" required>
        <Input defaultValue={values?.lastName} maxLength={60} autoComplete="off" />
      </FormField>
      <FormField label="Prénoms" name="firstName" required>
        <Input defaultValue={values?.firstName} maxLength={60} autoComplete="off" />
      </FormField>
      <FormField label="Sexe" name="gender">
        <Select defaultValue={values?.gender ?? ""}>
          <option value="">Non précisé</option>
          <option value="F">Femme</option>
          <option value="M">Homme</option>
        </Select>
      </FormField>
      <FormField label="Téléphone" name="phone">
        <Input type="tel" inputMode="tel" defaultValue={values?.phone ?? ""} />
      </FormField>
      <FormField
        label="NPI"
        name="npi"
        hint={values?.npi ? "Numéro personnel d'identification, enregistré au registre national." : "Facultatif. Numéro personnel d'identification, 10 chiffres."}
      >
        <Input inputMode="numeric" maxLength={14} defaultValue={values?.npi ?? ""} readOnly={!!values?.npi} autoComplete="off" />
      </FormField>
      {fromRegistry ? (
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Statut</span>
          <span className="text-muted">{TEACHER_STATUS_LABELS[values!.status!]}, inscrit au registre du ministère.</span>
        </div>
      ) : (
        <FormField label="Statut" name="status" required hint="Les agents de l'État (APE, ACE, AME) sont inscrits par le ministère : recherchez-les au registre.">
          <Select defaultValue={values?.status && statusOptions.includes(values.status) ? values.status : statusOptions[0]}>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {TEACHER_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </FormField>
      )}
      <FormField label="Spécialité" name="specialty" hint="Par exemple : Mathématiques">
        <Input defaultValue={values?.specialty ?? ""} maxLength={80} />
      </FormField>
      <FormField label="Date d'embauche" name="hiredAt">
        <Input type="date" defaultValue={values?.hiredAt ?? ""} />
      </FormField>
      {values && (
        <Switch name="isActive" defaultChecked={values.isActive} label="En activité" description="Un enseignant inactif ne figure plus dans les choix d'enseignant ni dans l'appel du personnel." labelClassName="sm:col-span-2" />
      )}
    </div>
  );
}

export function EditTeacherDialog({ values, statusOptions }: { values: TeacherValues; statusOptions: TeacherStatus[] }) {
  return (
    <FormDialog
      action={updateTeacher}
      title="Modifier l'enseignant"
      description="Les nom, prénoms, téléphone et NPI sont ceux du registre national : ils changent aussi dans les autres établissements de la personne."
      triggerVariant="secondary"
      wide
      trigger={
        <>
          <Pencil aria-hidden /> Modifier
        </>
      }
    >
      <TeacherFields values={values} statusOptions={statusOptions} />
    </FormDialog>
  );
}
