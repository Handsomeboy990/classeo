import { Pencil, Plus } from "lucide-react";

import { FormDialog } from "@/components/kit/form-dialog";
import { FormField } from "@/components/kit/form-field";
import { Input, Select } from "@/components/ui/input";

import { createClassroom, saveAssignment, updateClassroom } from "../actions";

type Options = {
  levels: { id: string; name: string }[];
  teachers: { id: string; firstName: string; lastName: string; specialty: string | null }[];
  subjects: { id: string; name: string; code: string }[];
};

type ClassValues = { id: string; name: string; levelId: string; capacity: number; mainTeacherId: string | null };

function TeacherOptions({ teachers }: { teachers: Options["teachers"] }) {
  return (
    <>
      <option value="">Aucun pour le moment</option>
      {teachers.map((t) => (
        <option key={t.id} value={t.id}>
          {t.lastName} {t.firstName}
          {t.specialty ? ` (${t.specialty})` : ""}
        </option>
      ))}
    </>
  );
}

function ClassFields({ options, values }: { options: Options; values?: ClassValues }) {
  return (
    <>
      {values && <input type="hidden" name="id" value={values.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Nom de la classe" name="name" required hint="Par exemple : 6e C">
          <Input defaultValue={values?.name} maxLength={40} autoComplete="off" />
        </FormField>
        <FormField label="Niveau" name="levelId" required>
          <Select defaultValue={values?.levelId ?? ""}>
            <option value="" disabled>
              Choisir un niveau
            </option>
            {options.levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Capacité (places)" name="capacity" required>
          <Input type="number" min={1} max={200} defaultValue={values?.capacity ?? 60} inputMode="numeric" />
        </FormField>
        <FormField label="Professeur principal" name="mainTeacherId">
          <Select defaultValue={values?.mainTeacherId ?? ""}>
            <TeacherOptions teachers={options.teachers} />
          </Select>
        </FormField>
      </div>
    </>
  );
}

export function CreateClassDialog({ options }: { options: Options }) {
  return (
    <FormDialog
      action={createClassroom}
      title="Nouvelle classe"
      description="La classe est créée pour l'année scolaire active."
      submitLabel="Créer la classe"
      trigger={
        <>
          <Plus aria-hidden /> Nouvelle classe
        </>
      }
    >
      <ClassFields options={options} />
    </FormDialog>
  );
}

export function EditClassDialog({ options, values }: { options: Options; values: ClassValues }) {
  return (
    <FormDialog
      action={updateClassroom}
      title={`Modifier la ${values.name}`}
      triggerVariant="secondary"
      trigger={
        <>
          <Pencil aria-hidden /> Modifier
        </>
      }
    >
      <ClassFields options={options} values={values} />
    </FormDialog>
  );
}

type AssignmentValues = { subjectId: string; teacherId: string | null; coefficient: number; weeklyHours: number; subjectName: string };

export function AssignmentDialog({ classroomId, options, values }: { classroomId: string; options: Options; values?: AssignmentValues }) {
  return (
    <FormDialog
      action={saveAssignment}
      title={values ? `${values.subjectName} : enseignant et coefficient` : "Ajouter une matière"}
      description="Chaque matière a un enseignant, un coefficient pour la moyenne générale et un volume horaire hebdomadaire."
      triggerVariant={values ? "ghost" : "secondary"}
      triggerSize={values ? "sm" : "md"}
      triggerLabel={values ? `Modifier ${values.subjectName}` : undefined}
      trigger={
        values ? (
          <Pencil aria-hidden />
        ) : (
          <>
            <Plus aria-hidden /> Ajouter une matière
          </>
        )
      }
    >
      <input type="hidden" name="classroomId" value={classroomId} />
      <div className="grid gap-4 sm:grid-cols-2">
        {values ? (
          <input type="hidden" name="subjectId" value={values.subjectId} />
        ) : (
          <FormField label="Matière" name="subjectId" required className="sm:col-span-2">
            <Select defaultValue="">
              <option value="" disabled>
                Choisir une matière
              </option>
              {options.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <FormField label="Enseignant" name="teacherId" className="sm:col-span-2">
          <Select defaultValue={values?.teacherId ?? ""}>
            <TeacherOptions teachers={options.teachers} />
          </Select>
        </FormField>
        <FormField label="Coefficient" name="coefficient" required>
          <Input type="number" min={1} max={10} defaultValue={values?.coefficient ?? 1} inputMode="numeric" />
        </FormField>
        <FormField label="Heures par semaine" name="weeklyHours" required>
          <Input type="number" min={0} max={30} defaultValue={values?.weeklyHours ?? 2} inputMode="numeric" />
        </FormField>
      </div>
    </FormDialog>
  );
}
