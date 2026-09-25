"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { place, useAnchoredPanel } from "@/components/ui/popover-position";
import { cn } from "@/lib/utils";

// A panel opened from a top bar button (account, school switcher,
// accessibility on a large screen). popover="auto" gives the light dismiss:
// Escape or a click outside closes it, and focus goes back to the button.
// The panel is placed under the button, aligned on its start or end edge.
export function HeaderPopover({
  label,
  trigger,
  children,
  align = "end",
  width = 320,
  className,
  panelClassName,
  open: controlledOpen,
  onOpenChange,
}: {
  label: string;
  trigger: (props: { "aria-expanded": boolean; "aria-controls": string; "aria-haspopup": "dialog"; popoverTarget: string }) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: "start" | "end";
  width?: number;
  className?: string;
  panelClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const id = useId();
  const [own, setOwn] = useState(false);
  const open = controlledOpen ?? own;
  const wrap = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useAnchoredPanel(open, wrap, panel, { matchWidth: false, minWidth: width, preferredHeight: 560, align });

  const close = () => {
    setOwn(false);
    onOpenChange?.(false);
  };

  // The button toggles the panel natively (popovertarget), and the browser
  // closes it on Escape or a click outside: the state follows.
  useEffect(() => {
    const p = panel.current;
    if (!p) return;
    const onToggle = (e: Event) => {
      const next = (e as ToggleEvent).newState === "open";
      setOwn(next);
      onOpenChange?.(next);
    };
    // Placed before the first frame, so it never shows at a default spot.
    const onBefore = (e: Event) => {
      if ((e as ToggleEvent).newState === "open" && wrap.current) place(wrap.current, p, { matchWidth: false, minWidth: width, preferredHeight: 560, align });
    };
    p.addEventListener("toggle", onToggle);
    p.addEventListener("beforetoggle", onBefore);
    return () => {
      p.removeEventListener("toggle", onToggle);
      p.removeEventListener("beforetoggle", onBefore);
    };
  }, [onOpenChange, width, align]);

  // Focus moves into the panel when it opens.
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>("[data-autofocus], a[href], button:not([disabled]), input")?.focus());
  }, [open]);

  return (
    <div ref={wrap} className={cn("relative", className)}>
      {trigger({ "aria-expanded": open, "aria-controls": id, "aria-haspopup": "dialog", popoverTarget: id })}
      <div
        ref={panel}
        id={id}
        popover="auto"
        role="dialog"
        aria-label={label}
        className={cn("ds-popover ds-header-panel", panelClassName)}
      >
        <div className="max-h-(--panel-max-h) overflow-y-auto overscroll-contain">{typeof children === "function" ? children(close) : children}</div>
      </div>
    </div>
  );
}
