"use client";

import { Dialog } from "@/components/ui/dialog";

import { AccessibilityControls } from "./accessibility-controls";
import { Sheet } from "./sheet";
import { useCompact } from "./use-compact";

const TITLE = "Accessibilité";
const DESCRIPTION = "Ces réglages s'appliquent tout de suite et restent enregistrés sur cet appareil.";

// The display and voice settings: a bottom sheet on phones, a dialog on
// larger screens.
export function AccessibilityPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const compact = useCompact();
  if (compact) {
    return (
      <Sheet open={open} onClose={onClose} title={TITLE} description={DESCRIPTION}>
        <div className="pt-2">
          <AccessibilityControls />
        </div>
      </Sheet>
    );
  }
  return (
    <Dialog open={open} onClose={onClose} title={TITLE} description={DESCRIPTION}>
      <AccessibilityControls />
    </Dialog>
  );
}
