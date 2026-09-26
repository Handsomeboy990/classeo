import { FormField } from "@/components/kit/form-field";
import { Input, Select } from "@/components/ui/input";
import { STATE_STATUSES, TEACHER_STATUS_LABELS, type TeacherStatus } from "@/lib/domain/teacher-status";

export type StateTeacherValues = {
  profileId: string;
  lastName: string;
  firstName: string;
  gender: "F" | "M" | null;
  phone: string | null;
  npi: string | null;
  stateStatus: TeacherStatus | null;
  stateMatricule: string | null;
};

// Fields of the ministry's registry of State teachers, placed in a kit
// FormDialog. The State matricule is the one of the Ministry of Finance
// payslips.
export function StateTeacherFields({ values }: { values?: StateTeacherValues }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {values && <input type="hidden" name="profileId" value={values.profileId} />}
      <FormField label="Nom" name="lastName" required>
        <Input defaultValue={values?.lastName} maxLength={60} autoComplete="off" />
      </FormField>
      <FormField label="Prénoms" name="firstName" required>
        <Input defaultValue={values?.firstName} maxLength={60} autoComplete="off" />
      </FormField>
      <FormField label="Statut" name="stateStatus" required>
        <Select defaultValue={values?.stateStatus ?? "APE"}>
          {STATE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TEACHER_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Matricule de l'État" name="stateMatricule" required hint="Celui des bulletins de paie du ministère des Finances.">
        <Input defaultValue={values?.stateMatricule ?? ""} maxLength={20} autoComplete="off" />
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
      <FormField label="NPI" name="npi" hint="Facultatif. 10 chiffres.">
        <Input inputMode="numeric" maxLength={14} defaultValue={values?.npi ?? ""} readOnly={!!values?.npi} autoComplete="off" />
      </FormField>
    </div>
  );
}
