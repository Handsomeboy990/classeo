"use client";

import { Info } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import { supportsPopover } from "@/components/ui/popover-position";
import { cn } from "@/lib/utils";

import { tipPosition } from "./info-tip-position";

// Fired when a bubble opens, so any other one closes: one at a time.
const OPEN_EVENT = "classeo:info-tip";
const CLOSE_DELAY = 120;

// An explanation kept out of the flow of the page: an "i" in a circle next
// to what it explains, the text in a bubble.
//
// - Mouse: the bubble shows while the pointer is on the "i" or on the
//   bubble itself (it can be reached to select or zoom the text).
// - Keyboard: it shows when the "i" gets the focus, hides on blur.
// - Touch, or a click: the "i" toggles it (aria-expanded); a tap elsewhere
//   closes it.
// - Escape always closes it, without closing a dialog around it.
//
// The text stays in the document, hidden, and is the button's accessible
// description (aria-describedby, role="tooltip"): a screen reader hears it
// on focus without opening anything, and the translation layer translates
// it like the rest of the page. The bubble lives in the top layer (Popover
// API), so a table, a card or a dialog never clips it; it is placed above
// the button or under it and slides to stay inside the window, at any zoom.
// Field errors and instructions a person needs to succeed stay in the page:
// this is for the "why" and the "how it is computed".
export function InfoTip({
  children,
  label = "Plus d'informations",
  className,
}: {
  // The explanation. Plain phrasing content (text, strong, links).
  children: ReactNode;
  // Accessible name of the button, e.g. "À propos du taux de réussite".
  label?: string;
  className?: string;
}) {
  const id = useId();
  const tipId = `${id}-tip`;
  const button = useRef<HTMLButtonElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hover || focus || pinned;

  const closeAll = useCallback(() => {
    clearTimeout(timer.current);
    setHover(false);
    setFocus(false);
    setPinned(false);
  }, []);

  const place = useCallback(() => {
    const b = button.current;
    const t = tip.current;
    if (!b || !t) return;
    const r = b.getBoundingClientRect();
    const vv = window.visualViewport;
    const p = tipPosition(
      { top: r.top, left: r.left, width: r.width, height: r.height },
      { width: t.offsetWidth, height: t.offsetHeight },
      { width: document.documentElement.clientWidth, height: vv ? vv.height + vv.offsetTop : window.innerHeight },
    );
    t.style.top = `${p.top}px`;
    t.style.left = `${p.left}px`;
    t.style.setProperty("--tip-arrow", `${p.arrow}px`);
    t.dataset.side = p.side;
  }, []);

  // Shown in the top layer when the browser has it; otherwise the bubble is
  // a fixed element above the page (data-open).
  useLayoutEffect(() => {
    const t = tip.current;
    if (!t) return;
    const popover = supportsPopover();
    if (open) {
      if (popover && !t.matches(":popover-open")) t.showPopover();
      t.dataset.open = "";
      place();
      window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: tipId }));
    } else {
      if (popover && t.matches(":popover-open")) t.hidePopover();
      delete t.dataset.open;
    }
  }, [open, place, tipId]);

  useEffect(() => {
    const onOther = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== tipId) closeAll();
    };
    window.addEventListener(OPEN_EVENT, onOther);
    return () => window.removeEventListener(OPEN_EVENT, onOther);
  }, [tipId, closeAll]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // The bubble takes this Escape: a dialog around it stays open.
      e.preventDefault();
      e.stopPropagation();
      closeAll();
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (button.current?.contains(target) || tip.current?.contains(target)) return;
      closeAll();
    };
    const onMove = () => place();
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    window.visualViewport?.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      window.visualViewport?.removeEventListener("resize", onMove);
    };
  }, [open, closeAll, place]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const enter = (e: ReactPointerEvent) => {
    if (e.pointerType !== "mouse") return;
    clearTimeout(timer.current);
    setHover(true);
  };
  const leave = (e: ReactPointerEvent) => {
    if (e.pointerType !== "mouse") return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setHover(false), CLOSE_DELAY);
  };

  return (
    <span className={cn("ds-tip-wrap", className)} data-print-hide>
      <button
        ref={button}
        type="button"
        className="ds-tip-btn"
        aria-label={label}
        aria-describedby={tipId}
        aria-expanded={pinned}
        onClick={() => {
          setHover(false);
          setPinned((p) => !p);
        }}
        onFocus={(e) => {
          if (e.currentTarget.matches(":focus-visible")) setFocus(true);
        }}
        onBlur={(e) => {
          // Focus moving to a link inside the bubble keeps it open.
          if (tip.current?.contains(e.relatedTarget as Node | null)) return;
          setFocus(false);
          setPinned(false);
        }}
        onPointerEnter={enter}
        onPointerLeave={leave}
      >
        <Info aria-hidden />
      </button>
      <span ref={tip} id={tipId} role="tooltip" popover="manual" className="ds-tip" onPointerEnter={enter} onPointerLeave={leave}>
        {children}
      </span>
    </span>
  );
}
