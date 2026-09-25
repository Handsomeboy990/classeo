import { Pencil, Plus, UserPlus } from "lucide-react";

import { FormField } from "@/components/kit/form-field";
import { Input, Select } from "@/components/ui/input";
import { FormDialog } from "@/features/classes/components/form-dialog";
import { CHANNEL_LABELS, RELATIONSHIPS } from "@/features/students/labels";

import { addChild, createGuardian, updateGuardian } from "../actions";

type StudentChoice = { student: { id: string; firstName: string; lastName: string; matricule: string }; classroom: { name: string } };

type Values = {
  id: string;
  lastName: string;
  firstName: string;
  phone: string;
  profession: string | null;
  preferredChannel: keyof typeof CHANNEL_LABELS;
  prefersAudio: boolean;
};

function GuardianFields({ values }: { values?: Values }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {values && <input type="hidden" name="id" value={values.id} />}
      <FormField label="Nom" name="lastName" required>
        <Input defaultValue={values?.lastName} maxLength={60} autoComplete="off" />
      </FormField>
      <FormField label="Prénoms" name="firstName" required>
        <Input defaultValue={values?.firstName} maxLength={60} autoComplete="off" />
      </FormField>
      <FormField label="Téléphone" name="phone" required hint="Par exemple : 01 97 12 34 56">
        <Input type="tel" inputMode="tel" defaultValue={values?.phone} />
      </FormField>
      <FormField label="Profession" name="profession">
        <Input defaultValue={values?.profession ?? ""} maxLength={80} />
      </FormField>
      <FormField label="Canal de contact préféré" name="preferredChannel" required>
        <Select defaultValue={values?.preferredChannel ?? "APP"}>
          {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </FormField>
      <label className="inline-flex min-h-10 items-center gap-2 self-end text-sm font-semibold">
        <input type="checkbox" name="prefersAudio" defaultChecked={values?.prefersAudio} className="size-5 accent-primary" />
        Préfère les messages audio
      </label>
    </div>
  );
}

function ChildFields({ students }: { students: StudentChoice[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Enfant" name="studentId" required className="sm:col-span-2">
        <Select defaultValue="">
          <option value="" disabled>
            Choisir un élève
          </option>
          {students.map((s) => (
            <option key={s.student.id} value={s.student.id}>
              {s.student.lastName} {s.student.firstName} · {s.classroom.name} · {s.student.matricule}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Lien avec l'enfant" name="relationship" required>
        <Select defaultValue="Mère">
          {RELATIONSHIPS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
      </FormField>
      <label className="inline-flex min-h-10 items-center gap-2 self-end text-sm font-semibold">
        <input type="checkbox" name="isPrimary" className="size-5 accent-primary" />
        Parent principal (appelé en premier)
      </label>
    </div>
  );
}

export function CreateGuardianDialog({ students }: { students: StudentChoice[] }) {
  return (
    <FormDialog
      action={createGuardian}
      title="Nouveau parent ou tuteur"
      description="Un parent est toujours rattaché à au moins un enfant de l'établissement."
      submitLabel="Ajouter"
      wide
      trigger={
        <>
          <Plus aria-hidden /> Nouveau parent
        </>
      }
    >
      <GuardianFields />
      <ChildFields students={students} />
    </FormDialog>
  );
}

export function EditGuardianDialog({ values }: { values: Values }) {
  return (
    <FormDialog
      action={updateGuardian}
      title="Modifier le parent"
      triggerVariant="secondary"
      wide
      trigger={
        <>
          <Pencil aria-hidden /> Modifier
        </>
      }
    >
      <GuardianFields values={values} />
    </FormDialog>
  );
}

export function AddChildDialog({ guardianId, students }: { guardianId: string; students: StudentChoice[] }) {
  return (
    <FormDialog
      action={addChild}
      title="Rattacher un enfant"
      triggerVariant="secondary"
      trigger={
        <>
          <UserPlus aria-hidden /> Rattacher un enfant
        </>
      }
    >
      <input type="hidden" name="guardianId" value={guardianId} />
      <ChildFields students={students} />
    </FormDialog>
  );
}
