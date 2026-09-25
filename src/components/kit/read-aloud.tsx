"use client";

import { Square, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { isSupported, speak, stop as stopVoice } from "@/lib/voice/kora";

import { toast } from "./toaster";

// Visible text of a region, as a listener needs it: controls, icons and
// anything marked data-read-skip are left out, so the voice never reads
// "Écouter la page" or button labels in the middle of the content.
function readableText(root: HTMLElement) {
  const skip = "button, [role=button], [aria-hidden=true], [data-read-skip], script, style, select, input, textarea, nav";
  const parts: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node.parentElement?.closest(skip) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent?.trim();
    if (t) parts.push(t);
  }
  return parts.join(". ").replace(/\.\s*\./g, ".");
}

// "Kora", the voice of Classéo (see lib/voice/kora.ts). Reads a text, or the
// readable text of an element, with a French female voice from the device:
// no download, no server, works offline once the page is loaded.
export function ReadAloud({
  text,
  targetId,
  label = "Écouter",
  className,
  compact = false,
}: {
  text?: string;
  targetId?: string;
  label?: string;
  className?: string;
  compact?: boolean;
}) {
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => () => stopVoice(), []);

  function start() {
    if (!isSupported()) {
      toast("error", "La lecture vocale n'est pas disponible sur ce navigateur.");
      return;
    }
    const target = targetId ? document.getElementById(targetId) : null;
    const content = text ?? (target ? readableText(target) : "");
    if (!content.trim()) return;
    setSpeaking(true);
    void speak(content, () => setSpeaking(false));
  }

  function stop() {
    stopVoice();
    setSpeaking(false);
  }

  return (
    <button
      type="button"
      onClick={speaking ? stop : start}
      aria-pressed={speaking}
      title={speaking ? "Arrêter la lecture" : label}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border border-border-strong bg-surface font-semibold text-text hover:bg-surface-2",
        compact ? "size-9 justify-center" : "h-10 px-3 text-sm",
        speaking && "border-primary bg-primary-soft text-primary",
        className,
      )}
    >
      {speaking ? <Square className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
      <span className={compact ? "sr-only" : undefined}>{speaking ? "Arrêter" : label}</span>
    </button>
  );
}
