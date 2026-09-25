"use client";

import { useState, type ComponentProps, type ReactNode } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { ActionState } from "@/lib/action";

// A button that opens a form in a native dialog. The dialog closes on
// success; on failure it stays open with the input and the field errors.
// Generic: used by every pedagogy module for create and edit forms.
export function FormDialog({
  action,
  trigger,
  triggerVariant = "primary",
  triggerSize = "md",
  triggerLabel,
  title,
  description,
  submitLabel = "Enregistrer",
  children,
  wide = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  trigger: ReactNode;
  triggerVariant?: ComponentProps<typeof Button>["variant"];
  triggerSize?: ComponentProps<typeof Button>["size"];
  // Accessible name when the trigger shows an icon only.
  triggerLabel?: string;
  title: string;
  description?: string;
  submitLabel?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant={triggerVariant} size={triggerSize} onClick={() => setOpen(true)} aria-label={triggerLabel} title={triggerLabel}>
        {trigger}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title} description={description} className={wide ? "max-w-2xl" : undefined}>
        <ActionForm action={action} onSuccess={() => setOpen(false)} className="flex flex-col gap-4">
          {children}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <SubmitButton>{submitLabel}</SubmitButton>
          </div>
        </ActionForm>
      </Dialog>
    </>
  );
}
