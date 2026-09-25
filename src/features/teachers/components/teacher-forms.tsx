import { Pencil, Plus } from "lucide-react";

import { FormField } from "@/components/kit/form-field";
import { Input, Select, Switch } from "@/components/ui/input";
import { FormDialog } from "@/components/kit/form-dialog";

import { createTeacher, updateTeacher } from "../actions";

type Values = {
  id: string;
  lastName: string;
  firstName: string;
  gender: "F" | "M" | null;
  phone: string | null;
  specialty: string | null;
  hiredAt: string | null;
  isActive: boolean;
};

function Fields({ values }: { values?: Values }) {
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

export function CreateTeacherDialog() {
  return (
    <FormDialog
      action={createTeacher}
      title="Nouvel enseignant"
      description="Un matricule est attribué automatiquement. Le compte de connexion se crée depuis Comptes utilisateurs."
      submitLabel="Ajouter"
      wide
      trigger={
        <>
          <Plus aria-hidden /> Nouvel enseignant
        </>
      }
    >
      <Fields />
    </FormDialog>
  );
}

export function EditTeacherDialog({ values }: { values: Values }) {
  return (
    <FormDialog
      action={updateTeacher}
      title="Modifier l'enseignant"
      triggerVariant="secondary"
      wide
      trigger={
        <>
          <Pencil aria-hidden /> Modifier
        </>
      }
    >
      <Fields values={values} />
    </FormDialog>
  );
}
