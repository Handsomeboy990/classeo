"use client";

import { useState } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { Input, Select } from "@/components/ui/input";
import { FocusFirstError } from "@/features/fees/components/focus-first-error";
import { useCloseDialog } from "@/features/fees/components/form-dialog";
import { DAYS } from "@/lib/domain/timetable";

import { createSlot, updateSlot } from "../actions";

type Initial = { id: string; assignmentId: string; dayOfWeek: number; startTime: string; endTime: string; room: string | null };

// Create or edit a weekly slot. Conflicts (class or teacher already busy)
// are detected on the server and reported in a toast; the input stays.
export function SlotForm({
  assignments,
  initial,
  defaults,
  onDone,
}: {
  assignments: { id: string; label: string }[];
  initial?: Initial;
  defaults?: { room?: string };
  onDone?: () => void;
}) {
  const closeDialog = useCloseDialog();
  const [assignmentId, setAssignmentId] = useState(initial?.assignmentId ?? "");
  const [dayOfWeek, setDayOfWeek] = useState(String(initial?.dayOfWeek ?? 1));
  const [startTime, setStartTime] = useState(initial?.startTime ?? "08:00");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "10:00");
  const [room, setRoom] = useState(initial?.room ?? defaults?.room ?? "");

  return (
    <ActionForm action={initial ? updateSlot : createSlot} onSuccess={onDone ?? closeDialog} className="flex flex-col gap-4">
      <FocusFirstError />
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <FormField label="Matière et enseignant" name="assignmentId" required>
        <Select value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)}>
          <option value="" disabled>
            Choisir…
          </option>
          {assignments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Jour" name="dayOfWeek" required hint="Le samedi, les cours ont lieu le matin seulement.">
        <Select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}>
          {DAYS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </Select>
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Début" name="startTime" required>
          <Input type="time" step={300} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </FormField>
        <FormField label="Fin" name="endTime" required>
          <Input type="time" step={300} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </FormField>
      </div>
      <FormField label="Salle" name="room">
        <Input value={room} onChange={(e) => setRoom(e.target.value)} maxLength={60} autoComplete="off" />
      </FormField>
      <SubmitButton className="self-end">{initial ? "Enregistrer le cours" : "Ajouter le cours"}</SubmitButton>
    </ActionForm>
  );
}
