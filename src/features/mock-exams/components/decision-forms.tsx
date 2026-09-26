"use client";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormDialog } from "@/components/kit/form-dialog";
import { FormField } from "@/components/kit/form-field";
import { Textarea } from "@/components/ui/input";

import { decideExam, inviteSchools, respondInvitation } from "../actions";
import { SchoolPicker, type PickableSchool } from "./school-picker";

// The invited school answers once: accept or decline, with an optional word
// for the organiser.
export function RespondForm({ examId }: { examId: string }) {
  return (
    <ActionForm action={respondInvitation} className="flex flex-col gap-4">
      <input type="hidden" name="examId" value={examId} />
      <FormField label="Message à l'organisateur" name="note" hint="Facultatif : effectif, contraintes de calendrier…">
        <Textarea rows={3} maxLength={500} />
      </FormField>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <SubmitButton name="decision" value="DECLINED" variant="danger" pendingLabel="Envoi…">
          Décliner
        </SubmitButton>
        <SubmitButton name="decision" value="ACCEPTED" pendingLabel="Envoi…">
          Accepter l&apos;invitation
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

// The hierarchy validates or refuses a school initiated exam, always with a
// note sent to the schools.
export function DecideForm({ examId }: { examId: string }) {
  return (
    <ActionForm action={decideExam} className="flex flex-col gap-4">
      <input type="hidden" name="examId" value={examId} />
      <FormField label="Note de décision" name="note" required info="Elle est transmise à l'établissement organisateur et aux partenaires.">
        <Textarea rows={4} maxLength={2000} />
      </FormField>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <SubmitButton name="decision" value="REJECTED" variant="danger" pendingLabel="Traitement…">
          Refuser
        </SubmitButton>
        <SubmitButton name="decision" value="APPROVED" pendingLabel="Traitement…">
          Valider l&apos;examen
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function InviteDialog({ examId, levelId, schools, exclude, home }: { examId: string; levelId: string; schools: PickableSchool[]; exclude: string[]; home: { communeId: string; communeName: string; departmentName: string } }) {
  return (
    <FormDialog action={inviteSchools} trigger="Inviter d'autres établissements" triggerVariant="secondary" title="Inviter d'autres établissements" submitLabel="Envoyer les invitations" wide>
      <input type="hidden" name="examId" value={examId} />
      <SchoolPicker schools={schools} levelId={levelId} name="partnerIds" legend="Partenaires" home={home} exclude={exclude} />
    </FormDialog>
  );
}
