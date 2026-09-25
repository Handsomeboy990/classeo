"use client";

import { Accessibility } from "lucide-react";
import { useState } from "react";

import { Dialog } from "@/components/ui/dialog";

import { AccessibilityControls } from "./accessibility-controls";

export function AccessibilityButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex size-10 items-center justify-center rounded-lg border border-border-strong bg-surface text-text hover:bg-surface-2"
        aria-label="Réglages d'accessibilité"
        title="Accessibilité"
      >
        <Accessibility className="size-5" aria-hidden />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Accessibilité" description="Ces réglages s'appliquent tout de suite et restent enregistrés sur cet appareil.">
        <AccessibilityControls />
      </Dialog>
    </>
  );
}
