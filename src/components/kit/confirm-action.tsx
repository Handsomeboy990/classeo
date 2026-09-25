"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { ActionState } from "@/lib/action";

import { ActionForm, SubmitButton } from "./action-form";

// A destructive or irreversible action: always confirmed, never one click.
export function ConfirmAction({
  action,
  fields,
  trigger,
  title,
  description,
  confirmLabel = "Confirmer",
  tone = "danger",
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  trigger: (open: () => void) => ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: "danger" | "primary";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {trigger(() => setOpen(true))}
      <Dialog open={open} onClose={() => setOpen(false)} title={title}>
        <p className="text-sm text-muted">{description}</p>
        <ActionForm action={action} onSuccess={() => setOpen(false)} className="mt-5 flex justify-end gap-2">
          {Object.entries(fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <SubmitButton variant={tone} pendingLabel="Traitement…">
            {confirmLabel}
          </SubmitButton>
        </ActionForm>
      </Dialog>
    </>
  );
}
