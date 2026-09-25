"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

import { prefersReducedMotion } from "./use-compact";

const noop = () => () => {};

// Plays the closing slide, then closes the dialog for real.
function dismiss(el: HTMLDialogElement, panel: HTMLElement | null) {
  let timer = 0;
  const done = () => {
    window.clearTimeout(timer);
    panel?.removeEventListener("animationend", onEnd);
    el.removeAttribute("data-closing");
    if (panel) panel.style.transform = "";
    if (el.open) el.close();
  };
  function onEnd(e: AnimationEvent) {
    if (e.target === panel) done();
  }
  if (prefersReducedMotion() || !panel) return done();
  el.setAttribute("data-closing", "");
  panel.addEventListener("animationend", onEnd);
  timer = window.setTimeout(done, 260);
}

// Bottom sheet for the phone shell. A native modal <dialog> rendered into
// <body>: it sits in the top layer, so no ancestor with a backdrop filter or
// a transform can clip it, and the browser provides the focus trap, Escape
// and the inert page behind. Focus returns to the opener on close.
//
// Motion: slides up in 280 ms (transform only), down in 200 ms; the handle
// can be dragged down to dismiss. With reduced motion it simply appears.
export function Sheet({
  open,
  onClose,
  title,
  description,
  full = false,
  lead,
  header,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  // Full height (the menu), otherwise as tall as its content.
  full?: boolean;
  // Shown in place of the title, which then stays for screen readers only.
  lead?: ReactNode;
  // Extra content fixed under the title (a search field).
  header?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const closing = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      closing.current = false;
      el.removeAttribute("data-closing");
      el.showModal();
    }
    if (!open && el.open && !closing.current) {
      closing.current = true;
      dismiss(el, panel.current);
    }
  }, [open, mounted]);

  function requestClose() {
    onCloseRef.current();
  }

  // Drag the handle or the title bar down to dismiss.
  const drag = useRef<{ y: number; t: number; dy: number } | null>(null);
  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button, a, input")) return;
    drag.current = { y: e.clientY, t: e.timeStamp, dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current || !panel.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    panel.current.style.transition = "none";
    panel.current.style.transform = `translateY(${drag.current.dy}px)`;
  }
  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    drag.current = null;
    if (!d || !panel.current) return;
    const speed = d.dy / Math.max(1, e.timeStamp - d.t);
    panel.current.style.transition = "";
    if (d.dy > 96 || (d.dy > 24 && speed > 0.6)) requestClose();
    else panel.current.style.transform = "";
  }

  if (!mounted) return null;

  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      // Closed by the browser itself (a repeated Escape): keep state in step.
      onClose={() => !closing.current && requestClose()}
      onClick={(e) => e.target === ref.current && requestClose()}
      className={cn("sheet", full && "sheet-full")}
    >
      <div ref={panel} className={cn("sheet-panel", className)}>
        <div
          className="shrink-0 touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="flex justify-center pt-2 pb-1" aria-hidden>
            <span className="h-1 w-9 rounded-full bg-border-strong" />
          </div>
          <div className="flex items-center gap-3 px-4 pb-2">
            {lead && <div className="min-w-0 flex-1">{lead}</div>}
            <div className={cn("min-w-0 flex-1", lead && "sr-only")}>
              <h2 id={titleId} className="truncate text-lg font-bold">
                {title}
              </h2>
              {description && (
                <p id={descId} className="text-sm text-muted">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={requestClose}
              className="-mr-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-text active:bg-surface-2"
              aria-label="Fermer"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          {header}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </dialog>,
    document.body,
  );
}
