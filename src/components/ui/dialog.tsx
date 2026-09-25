"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

// Native <dialog>: focus trap, Escape and inert background come from the
// browser, with no JavaScript library to download. On a phone it opens as a
// bottom sheet (full width, within thumb reach, above the home indicator);
// from 40rem up, as a centred dialog. The look lives in globals.css
// (.ds-dialog).
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  // Actions kept visible under the scrolling body (e.g. Annuler, Enregistrer).
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      data-size={size}
      className={cn("ds-dialog", className)}
    >
      {open && (
        <>
          <div className="ds-sheet-handle" aria-hidden />
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 pt-3 pb-4 sm:pt-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg leading-snug font-bold text-balance">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="mt-1 text-sm text-muted">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mt-1 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-surface-2 hover:text-text sm:size-9"
              aria-label="Fermer"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="ds-dialog-body">{children}</div>
          {footer && <div className="ds-dialog-footer">{footer}</div>}
        </>
      )}
    </dialog>
  );
}
