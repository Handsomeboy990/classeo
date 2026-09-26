import { Pencil } from "lucide-react";

import { FormDialog } from "@/components/kit/form-dialog";
import { FormField } from "@/components/kit/form-field";
import { Input, Select, Switch } from "@/components/ui/input";

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
};

export function TeacherFields({ values }: { values?: TeacherValues }) {
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
        info={values?.npi ? "Numéro personnel d'identification, enregistré au registre national." : "Facultatif. Numéro personnel d'identification, 10 chiffres."}
      >
        <Input inputMode="numeric" maxLength={14} defaultValue={values?.npi ?? ""} readOnly={!!values?.npi} autoComplete="off" />
      </FormField>
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

export function EditTeacherDialog({ values }: { values: TeacherValues }) {
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
      <TeacherFields values={values} />
    </FormDialog>
  );
}
