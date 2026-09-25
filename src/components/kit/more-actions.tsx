"use client";

import { ChevronDown, MoreHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// "Plus d'actions": the secondary actions of a page behind one button, so the
// main ones keep their room. A disclosure (button with aria-expanded and a
// panel right under it), not an ARIA menu: the items are ordinary links and
// buttons, reached with Tab, and each keeps its own behaviour (download, a
// confirmation dialog).
//
// Closes with Escape (focus back on the button), a click outside, or after
// following a link. An item that opens a dialog leaves the panel open under
// it, so focus comes back to that item when the dialog closes. The panel
// stays mounted while closed, which keeps the items' dialogs alive.
// Item look: .ds-menu in globals.css.
export function MoreActions({ children, label = "Plus d'actions", className }: { children: ReactNode; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      // A dialog opened from an item is modal: clicks land in it, not outside.
      if (document.querySelector("dialog[open]")) return;
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div
      ref={root}
      data-print-hide
      className={cn("relative inline-flex print:hidden", className)}
      onKeyDown={(e) => {
        // Escape inside an item's dialog belongs to that dialog.
        if (e.key !== "Escape" || !open || (e.target as HTMLElement).closest("dialog")) return;
        e.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }}
    >
      <Button ref={trigger} type="button" variant="secondary" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)} className="w-full">
        <MoreHorizontal aria-hidden />
        {label}
        <ChevronDown aria-hidden className={cn("transition-transform duration-150", open && "rotate-180")} />
      </Button>
      <div
        id={panelId}
        hidden={!open}
        className="ds-menu absolute top-full right-0 z-40 mt-2 w-max max-w-[calc(100vw-2rem)] min-w-60"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setOpen(false);
        }}
      >
        {children}
      </div>
    </div>
  );
}
