"use client";

import { Accessibility } from "lucide-react";
import { useState } from "react";

import { AccessibilityPanel } from "./accessibility-panel";

// Header variant, for pages that keep the settings in their top bar: the
// public home page, and the private space on a large screen. Phones in the
// private space use AccessibilityFab and the account and Menu sheets.
export function AccessibilityButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex size-10 items-center justify-center rounded-lg border border-border-strong bg-surface text-text hover:bg-surface-2"
        aria-label="Réglages d'accessibilité"
        aria-haspopup="dialog"
        title="Accessibilité"
      >
        <Accessibility className="size-5" aria-hidden />
      </button>
      <AccessibilityPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
