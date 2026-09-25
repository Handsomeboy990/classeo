"use client";

import { Accessibility, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { place } from "@/components/ui/popover-position";

import { AccessibilityControls } from "./accessibility-controls";
import { Sheet } from "./sheet";
import { useCompact } from "./use-compact";

const TITLE = "Accessibilité";
const DESCRIPTION = "Ces réglages s'appliquent tout de suite et restent enregistrés sur cet appareil.";

// The accessibility button, bottom right on every screen as on most sites
// and apps: a round, discreet button (surface colour, hairline, soft
// shadow), above the tab bar on phones. While the page scrolls it slides
// into a small tab on the right edge, out of the reading line, and comes
// back 900 ms after the scroll stops; keyboard focus always brings it back.
// A page with an action bar stuck to the bottom (data-action-bar) hides it:
// the Menu and account sheets carry the same settings.
// It opens a bottom sheet on phones and a panel above the button on larger
// screens.
export function AccessibilityFab() {
  const compact = useCompact();
  const [sheet, setSheet] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [edge, setEdge] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer = 0;
    let last = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      if (Math.abs(y - last) > 4 && y > 48) setEdge(true);
      last = y;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setEdge(false), 900);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
    };
  }, []);

  // Large screens: a panel in the top layer, placed above the button before
  // its first frame; Escape and a click outside close it (popover="auto").
  useEffect(() => {
    const p = panel.current;
    if (!p) return;
    const before = (e: Event) => {
      if ((e as ToggleEvent).newState === "open" && button.current) place(button.current, p, { matchWidth: false, minWidth: 360, preferredHeight: 640, align: "end" });
    };
    const toggle = (e: Event) => {
      const open = (e as ToggleEvent).newState === "open";
      setPanelOpen(open);
      if (open) requestAnimationFrame(() => p.querySelector<HTMLElement>("input:checked, button")?.focus());
    };
    p.addEventListener("beforetoggle", before);
    p.addEventListener("toggle", toggle);
    return () => {
      p.removeEventListener("beforetoggle", before);
      p.removeEventListener("toggle", toggle);
    };
  }, [compact]);

  const open = compact ? sheet : panelOpen;

  return (
    <>
      <button
        ref={button}
        type="button"
        data-edge={edge && !open ? "" : undefined}
        // Large screens: the browser toggles the panel (popovertarget), so a
        // second click closes it instead of reopening it after the light
        // dismiss.
        popoverTarget={compact ? undefined : "a11y-panel"}
        onClick={compact ? () => setSheet(true) : undefined}
        className="a11y-fab inline-flex size-(--fab-size) items-center justify-center rounded-full border border-border bg-surface text-text shadow-raised hover:bg-surface-2"
        aria-label="Réglages d'accessibilité"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Accessibilité"
      >
        <Accessibility className="size-5.5" aria-hidden />
      </button>
      {compact ? (
        <Sheet open={sheet} onClose={() => setSheet(false)} title={TITLE} description={DESCRIPTION}>
          <div className="pt-2">
            <AccessibilityControls />
          </div>
        </Sheet>
      ) : (
        <div ref={panel} id="a11y-panel" popover="auto" role="dialog" aria-labelledby="a11y-panel-title" className="ds-popover ds-header-panel a11y-panel">
          <div className="flex max-h-(--panel-max-h) flex-col">
            <div className="flex items-start gap-3 border-b border-border px-5 pt-4 pb-3">
              <div className="min-w-0 flex-1">
                <h2 id="a11y-panel-title" className="text-lg font-bold">
                  {TITLE}
                </h2>
                <p className="text-sm text-muted">{DESCRIPTION}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  panel.current?.hidePopover();
                  button.current?.focus();
                }}
                className="-mr-2 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-text"
                aria-label="Fermer"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-4">
              <AccessibilityControls />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
