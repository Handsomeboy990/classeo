"use client";

import { useLayoutEffect, type RefObject } from "react";

// Anchored panels (combobox list, calendar) live in the top layer through
// the Popover API: a dialog's overflow can never clip them and they stay
// above modal dialogs and sheets. Without the API the enhanced controls are
// not used at all and the native control stays.
export function supportsPopover() {
  return typeof HTMLElement !== "undefined" && Object.prototype.hasOwnProperty.call(HTMLElement.prototype, "popover");
}

const GAP = 6;
const MARGIN = 8;

export type PanelOptions = { matchWidth?: boolean; minWidth?: number; preferredHeight?: number; align?: "start" | "end" };

// Under the anchor, or above it when there is more room there, never wider
// than the window.
export function place(anchor: HTMLElement, panel: HTMLElement, { matchWidth = true, minWidth = 0, preferredHeight = 320, align = "start" }: PanelOptions) {
  const r = anchor.getBoundingClientRect();
  const vv = window.visualViewport;
  const vh = vv ? vv.height + vv.offsetTop : window.innerHeight;
  const vw = document.documentElement.clientWidth;
  const below = vh - r.bottom - GAP - MARGIN;
  const above = r.top - GAP - MARGIN;
  const up = below < Math.min(preferredHeight, 220) && above > below;
  const room = Math.max(120, up ? above : below);
  const width = Math.min(vw - MARGIN * 2, Math.max(matchWidth ? r.width : 0, minWidth));
  const left = Math.min(Math.max(MARGIN, align === "end" ? r.right - width : r.left), vw - MARGIN - width);
  const s = panel.style;
  s.setProperty("--panel-max-h", `${Math.min(room, preferredHeight)}px`);
  s.width = `${width}px`;
  s.left = `${left}px`;
  s.top = up ? "auto" : `${r.bottom + GAP}px`;
  s.bottom = up ? `${window.innerHeight - r.top + GAP}px` : "auto";
  panel.dataset.side = up ? "top" : "bottom";
}

function toggle(panel: HTMLElement, open: boolean) {
  const shown = panel.matches(":popover-open");
  if (open && !shown) panel.showPopover();
  if (!open && shown) panel.hidePopover();
}

// Shows the panel while open and keeps it placed through scrolls, resizes
// and the phone keyboard (visual viewport).
export function useAnchoredPanel(open: boolean, anchor: RefObject<HTMLElement | null>, panel: RefObject<HTMLElement | null>, opts: PanelOptions = {}) {
  const { matchWidth, minWidth, preferredHeight, align } = opts;
  useLayoutEffect(() => {
    const a = anchor.current;
    const p = panel.current;
    if (!a || !p) return;
    toggle(p, open);
    if (!open) return;
    const update = () => place(a, p, { matchWidth, minWidth, preferredHeight, align });
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, [open, anchor, panel, matchWidth, minWidth, preferredHeight, align]);
}

// Accents and case do not matter when searching: "eleve" finds "Élève".
export function fold(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}
