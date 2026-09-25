"use client";

import { createContext, useContext, useState, type ComponentProps, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { ActionState } from "@/lib/action";

import { ActionForm, SubmitButton } from "./action-form";

type ServerAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const CloseContext = createContext<() => void>(() => {});

// A form placed in a FormDialog without `action` calls this on success to
// close the dialog.
export const useCloseDialog = () => useContext(CloseContext);

// A button that opens a form in a dialog (a bottom sheet on a phone).
// Usable from a server component: every prop is serialisable, the action is
// a server action.
//
// - With `action`: the dialog holds an ActionForm with the fields passed as
//   children, and Annuler and submit buttons kept in view at the bottom. It
//   closes on success; on failure it stays open with what the user typed
//   and the field errors, focus on the first invalid field.
// - Without `action`: the children are free (a form of their own), and they
//   close the dialog with useCloseDialog().
export function FormDialog({
  action,
  trigger,
  triggerVariant,
  triggerSize,
  variant,
  size,
  triggerLabel,
  triggerClassName,
  title,
  description,
  submitLabel = "Enregistrer",
  pendingLabel,
  cancelLabel = "Annuler",
  children,
  wide = false,
  dialogSize,
  onSuccess,
}: {
  action?: ServerAction;
  trigger: ReactNode;
  triggerVariant?: ComponentProps<typeof Button>["variant"];
  triggerSize?: ComponentProps<typeof Button>["size"];
  // Aliases of triggerVariant and triggerSize, as named in the fees module.
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  // Accessible name when the trigger shows an icon only.
  triggerLabel?: string;
  triggerClassName?: string;
  title: string;
  description?: string;
  submitLabel?: string;
  pendingLabel?: string;
  cancelLabel?: string;
  children: ReactNode;
  wide?: boolean;
  dialogSize?: ComponentProps<typeof Dialog>["size"];
  onSuccess?: (state: ActionState) => void;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <Button
        type="button"
        variant={triggerVariant ?? variant ?? "primary"}
        size={triggerSize ?? size ?? "md"}
        onClick={() => setOpen(true)}
        aria-label={triggerLabel}
        title={triggerLabel}
        className={triggerClassName}
      >
        {trigger}
      </Button>
      <Dialog open={open} onClose={close} title={title} description={description} size={dialogSize ?? (wide ? "lg" : "md")}>
        <CloseContext.Provider value={close}>
          {action ? (
            // React resets a form after its action returns, even on a
            // validation failure; cancelling the reset keeps what was typed.
            <ActionForm
              action={action}
              onSuccess={(state) => {
                close();
                onSuccess?.(state);
              }}
              onReset={(e) => e.preventDefault()}
              className="flex flex-col gap-4"
            >
              {children}
              <div className="ds-dialog-actions">
                <Button type="button" variant="secondary" onClick={close}>
                  {cancelLabel}
                </Button>
                <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
              </div>
            </ActionForm>
          ) : (
            children
          )}
        </CloseContext.Provider>
      </Dialog>
    </>
  );
}
