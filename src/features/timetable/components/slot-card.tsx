"use client";

import { Ban, Clock, DoorOpen, Pencil, RotateCcw, Trash2, User } from "lucide-react";
import { useState } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { ConfirmAction } from "@/components/kit/confirm-action";
import { FormField } from "@/components/kit/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FocusFirstError } from "@/features/fees/components/focus-first-error";
import { DAYS } from "@/lib/domain/timetable";
import { cn } from "@/lib/utils";

import { cancelSlotOnDate, deleteSlot, restoreSlot } from "../actions";
import type { SlotView } from "../queries";

import { SlotForm } from "./slot-form";

export type SlotRights = { update: boolean; delete: boolean };

const PALETTE = ["bg-primary-soft", "bg-info-soft", "bg-accent-soft", "bg-warning-soft", "bg-success-soft", "bg-surface-2"];

export function subjectTone(code: string) {
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

function slotLabel(s: SlotView, showClass: boolean) {
  return [
    `${DAYS[s.dayOfWeek - 1]?.label} de ${s.startTime} à ${s.endTime}`,
    s.subject,
    showClass ? s.classroom : s.teacher,
    s.room,
    s.cancellation ? "séance annulée cette semaine" : null,
  ]
    .filter(Boolean)
    .join(", ");
}

// Body of a slot, shared by the grid and the day list.
function SlotBody({ slot, showClass, compact }: { slot: SlotView; showClass: boolean; compact?: boolean }) {
  return (
    <>
      <span className={cn("block truncate font-semibold", slot.cancellation && "line-through")} title={slot.subject}>
        {slot.subject}
      </span>
      <span className="block text-xs text-muted">
        {slot.startTime} à {slot.endTime}
      </span>
      {!compact && (
        <span className="block truncate text-xs">
          {showClass ? slot.classroom : (slot.teacher ?? "Sans enseignant")}
          {slot.room ? ` · ${slot.room}` : ""}
        </span>
      )}
      {slot.cancellation && (
        <Badge tone="danger" className="mt-1 self-start">
          <Ban aria-hidden /> Annulé
        </Badge>
      )}
    </>
  );
}

// A slot in the grid or list. With rights, it opens a dialog to edit, cancel
// one session or remove the course; without, it is plain text.
export function SlotCard({
  slot,
  showClass,
  rights,
  assignments,
  sessionDate,
  className,
  compact,
}: {
  slot: SlotView;
  showClass: boolean;
  rights: SlotRights;
  assignments: { id: string; label: string }[];
  sessionDate: string;
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const tone = subjectTone(slot.subjectCode);
  const base = cn("flex h-full w-full min-w-0 flex-col items-stretch justify-start overflow-hidden rounded-lg border border-border p-2 text-left text-sm leading-snug text-text", tone, slot.cancellation && "opacity-80", className);
  const label = slotLabel(slot, showClass);

  if (!rights.update && !rights.delete)
    return (
      <div className={base} aria-label={label} role="group">
        <SlotBody slot={slot} showClass={showClass} compact={compact} />
      </div>
    );

  const close = () => {
    setOpen(false);
    setMode("view");
  };

  return (
    <>
      <button type="button" className={cn(base, "hover:border-primary")} aria-label={`${label}. Ouvrir pour modifier.`} onClick={() => setOpen(true)}>
        <SlotBody slot={slot} showClass={showClass} compact={compact} />
      </button>
      <Dialog open={open} onClose={close} title={`${slot.subject} · ${slot.classroom}`} description={`${DAYS[slot.dayOfWeek - 1]?.label} de ${slot.startTime} à ${slot.endTime}`}>
        {mode === "edit" ? (
          <SlotForm assignments={assignments} initial={slot} onDone={close} />
        ) : (
          <div className="flex flex-col gap-5">
            <ul className="flex flex-col gap-1.5 text-sm">
              <li className="flex items-center gap-2">
                <User className="size-4 text-muted" aria-hidden /> {slot.teacher ?? "Sans enseignant"}
              </li>
              <li className="flex items-center gap-2">
                <Clock className="size-4 text-muted" aria-hidden /> {slot.startTime} à {slot.endTime}
              </li>
              {slot.room && (
                <li className="flex items-center gap-2">
                  <DoorOpen className="size-4 text-muted" aria-hidden /> {slot.room}
                </li>
              )}
            </ul>

            {rights.update && (
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                {slot.cancellation ? (
                  <ActionForm action={restoreSlot} onSuccess={close} className="flex flex-col gap-2">
                    <input type="hidden" name="id" value={slot.cancellation.id} />
                    <p className="text-sm">
                      Séance annulée le {slot.cancellation.date.split("-").reverse().join("/")}
                      {slot.cancellation.note ? ` : ${slot.cancellation.note}` : "."}
                    </p>
                    <SubmitButton variant="secondary" className="self-start">
                      <RotateCcw aria-hidden /> Rétablir la séance
                    </SubmitButton>
                  </ActionForm>
                ) : (
                  <CancelSessionForm slotId={slot.id} defaultDate={sessionDate} onDone={close} />
                )}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              {rights.delete && (
                <ConfirmAction
                  action={deleteSlot}
                  fields={{ id: slot.id }}
                  title="Retirer ce cours ?"
                  description={`${slot.subject}, ${DAYS[slot.dayOfWeek - 1]?.label.toLowerCase()} de ${slot.startTime} à ${slot.endTime}, sera retiré de toutes les semaines.`}
                  confirmLabel="Retirer le cours"
                  trigger={(openConfirm) => (
                    <Button type="button" variant="ghost" className="text-danger" onClick={openConfirm}>
                      <Trash2 aria-hidden /> Retirer le cours
                    </Button>
                  )}
                />
              )}
              {rights.update && (
                <Button type="button" variant="secondary" onClick={() => setMode("edit")}>
                  <Pencil aria-hidden /> Modifier
                </Button>
              )}
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}

function CancelSessionForm({ slotId, defaultDate, onDone }: { slotId: string; defaultDate: string; onDone: () => void }) {
  const [date, setDate] = useState(defaultDate);
  const [note, setNote] = useState("");
  return (
    <ActionForm action={cancelSlotOnDate} onSuccess={onDone} className="flex flex-col gap-3">
      <FocusFirstError />
      <p className="text-sm font-semibold">Annuler une séance</p>
      <input type="hidden" name="slotId" value={slotId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Date" name="date" required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FormField>
        <FormField label="Motif" name="note">
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Enseignant absent…" />
        </FormField>
      </div>
      <SubmitButton variant="secondary" className="self-start">
        <Ban aria-hidden /> Annuler cette séance
      </SubmitButton>
    </ActionForm>
  );
}
