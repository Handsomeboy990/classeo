import { Lock, LockOpen, Plus, Settings2 } from "lucide-react";

import { FormField } from "@/components/kit/form-field";
import { Input, Select } from "@/components/ui/input";
import { ConfirmButton } from "@/components/kit/confirm-button";
import { FormDialog } from "@/components/kit/form-dialog";
import { defaultSheetConfig, FORMULA_LABELS, type SheetConfig } from "@/lib/domain/grade-entry";

import { createSheet, setClassLock, setSheetLock, updateSheet } from "../actions";

type Config = SheetConfig;

// A school without compositions applies the national formula only; the
// others choose among every formula.
function ConfigFields({ values, allowsComposition }: { values?: Config; allowsComposition: boolean }) {
  const v = values ?? defaultSheetConfig({ allowsComposition });
  return (
    <>
      {allowsComposition ? (
        <FormField label="Formule de calcul de la moyenne" name="formula" required>
          <Select defaultValue={v.formula}>
            {Object.entries(FORMULA_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
      ) : (
        <div className="flex flex-col gap-1 text-sm">
          <input type="hidden" name="formula" value="OFFICIAL_2024" />
          <input type="hidden" name="compositionCount" value="0" />
          <span className="font-semibold text-text">Formule de calcul de la moyenne</span>
          <span className="text-muted">{FORMULA_LABELS.OFFICIAL_2024}.</span>
        </div>
      )}
      <div className={allowsComposition ? "grid gap-4 sm:grid-cols-3" : "grid gap-4 sm:grid-cols-2"}>
        <FormField label="Interrogations écrites" name="interrogationCount" required hint="De 1 à 6">
          <Input type="number" min={1} max={6} defaultValue={v.interrogationCount} inputMode="numeric" />
        </FormField>
        <FormField label="Devoirs surveillés" name="devoirCount" required hint="De 0 à 3">
          <Input type="number" min={0} max={3} defaultValue={v.devoirCount} inputMode="numeric" />
        </FormField>
        {allowsComposition && (
          <FormField label="Compositions" name="compositionCount" required hint="De 0 à 2">
            <Input type="number" min={0} max={2} defaultValue={v.compositionCount} inputMode="numeric" />
          </FormField>
        )}
      </div>
    </>
  );
}

export function CreateSheetDialog({
  assignments,
  periods,
  defaultPeriodId,
  allowsComposition,
}: {
  assignments: { id: string; subject: { name: string }; classroom: { name: string } }[];
  periods: { id: string; name: string }[];
  defaultPeriodId: string;
  allowsComposition: boolean;
}) {
  return (
    <FormDialog
      action={createSheet}
      title="Nouvelle fiche de notes"
      description="Une fiche par matière, par classe et par période."
      submitLabel="Créer la fiche"
      trigger={
        <>
          <Plus aria-hidden /> Nouvelle fiche
        </>
      }
    >
      <FormField label="Classe et matière" name="assignmentId" required>
        <Select defaultValue="">
          <option value="" disabled>
            {assignments.length ? "Choisir" : "Toutes vos matières ont déjà une fiche"}
          </option>
          {assignments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.classroom.name} · {a.subject.name}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Période" name="periodId" required>
        <Select defaultValue={defaultPeriodId}>
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </FormField>
      <ConfigFields allowsComposition={allowsComposition} />
    </FormDialog>
  );
}

export function SheetSettingsDialog({ id, values, allowsComposition }: { id: string; values: Config; allowsComposition: boolean }) {
  return (
    <FormDialog
      action={updateSheet}
      title="Paramètres de la fiche"
      description="Nombre d'évaluations et formule de calcul. Les moyennes sont recalculées aussitôt."
      triggerVariant="secondary"
      trigger={
        <>
          <Settings2 aria-hidden /> Paramètres
        </>
      }
    >
      <input type="hidden" name="id" value={id} />
      <ConfigFields values={values} allowsComposition={allowsComposition} />
    </FormDialog>
  );
}

export function SheetLockButton({ id, locked, label }: { id: string; locked: boolean; label: string }) {
  return (
    <ConfirmButton
      action={setSheetLock}
      fields={{ id, lock: locked ? "false" : "true" }}
      tone="primary"
      variant={locked ? "secondary" : "primary"}
      title={locked ? `Déverrouiller la fiche ${label} ?` : `Verrouiller la fiche ${label} ?`}
      description={
        locked
          ? "L'enseignant pourra de nouveau modifier les notes. Pensez à reverrouiller avant la publication des bulletins."
          : "Plus aucune note ne pourra être modifiée tant que la fiche reste verrouillée. Les bulletins s'appuient sur les fiches verrouillées."
      }
      confirmLabel={locked ? "Déverrouiller" : "Verrouiller"}
    >
      {locked ? <LockOpen aria-hidden /> : <Lock aria-hidden />}
      {locked ? "Déverrouiller" : "Verrouiller"}
    </ConfirmButton>
  );
}

export function ClassLockButtons({ classroomId, periodId, className }: { classroomId: string; periodId: string; className: string }) {
  return (
    <>
      <ConfirmButton
        action={setClassLock}
        fields={{ classroomId, periodId, lock: "true" }}
        tone="primary"
        variant="secondary"
        title={`Verrouiller toutes les fiches de la ${className} ?`}
        description="Toutes les fiches de la classe pour cette période seront figées. Vous pourrez les déverrouiller si besoin."
        confirmLabel="Tout verrouiller"
      >
        <Lock aria-hidden /> Verrouiller la classe
      </ConfirmButton>
      <ConfirmButton
        action={setClassLock}
        fields={{ classroomId, periodId, lock: "false" }}
        tone="primary"
        variant="ghost"
        title={`Déverrouiller toutes les fiches de la ${className} ?`}
        description="Les enseignants pourront de nouveau modifier les notes de cette classe pour la période."
        confirmLabel="Tout déverrouiller"
      >
        <LockOpen aria-hidden /> Déverrouiller la classe
      </ConfirmButton>
    </>
  );
}
