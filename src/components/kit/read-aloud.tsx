"use client";

import { Square, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";

import { frenchTextOf, speechLanguage } from "@/features/languages/client";
import { inLanguage } from "@/features/languages/languages";
import { TranslateContent } from "@/features/languages/translate-content";
import { cn } from "@/lib/utils";
import { isSupported, playClips, primeAudio, speak, stop as stopVoice } from "@/lib/voice/kora";

import { toast } from "./toaster";

// Visible text of a region, as a listener needs it: controls, icons and
// anything marked data-read-skip are left out, so the voice never reads
// "Écouter la page" or button labels in the middle of the content. Always
// the French text, even when the page shows a translation: the voice in a
// local language is produced from the French source.
function readableText(root: HTMLElement) {
  const skip = "button, [role=button], [aria-hidden=true], [data-read-skip], script, style, select, input, textarea, nav, dialog";
  const parts: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node.parentElement?.closest(skip) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = frenchTextOf(n as Text).trim();
    if (t) parts.push(t);
  }
  return parts.join(". ").replace(/\.\s*\./g, ".");
}

// "Kora", the voice of Classéo (see lib/voice/kora.ts). Reads a text, or the
// readable text of an element, with a French female voice from the device:
// no download, no server, works offline once the page is loaded. For a user
// who chose Fon, Yoruba or Hausa (translation:view), it reads in that
// language with the voice of the translation service, and falls back to
// French whenever that voice is not available. With a text of its own, it
// also offers "Traduire en ..." to the same users.
export function ReadAloud({
  text,
  targetId,
  label = "Écouter",
  className,
  compact = false,
  translatable = true,
}: {
  text?: string;
  targetId?: string;
  // Language of the voice for a French text: "fon" or "yo" plays the local
  // voice of that source. Defaults to French.
  lang?: "fr" | "fon" | "yo";
  label?: string;
  className?: string;
  // true: icon only. "mobile": icon only below 40rem, labelled above.
  compact?: boolean | "mobile";
  // false: no "Traduire" button next to this one.
  translatable?: boolean;
}) {
  const [speaking, setSpeaking] = useState(false);
  const [preparing, setPreparing] = useState(false);

  useEffect(() => () => stopVoice(), []);

  function french(content: string) {
    if (!isSupported()) {
      setSpeaking(false);
      toast("error", "La lecture vocale n'est pas disponible sur ce navigateur.");
      return;
    }
    setSpeaking(true);
    void speak(content, () => setSpeaking(false));
  }

  async function local(content: string, target: NonNullable<ReturnType<typeof speechLanguage>>) {
    primeAudio();
    setSpeaking(true);
    setPreparing(true);
    try {
      const res = await fetch("/api/langues/voix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang: target.lang, text: content.slice(0, 6000) }),
      });
      const body = (await res.json().catch(() => ({}))) as { clips?: string[] };
      if (!res.ok || !body.clips?.length) throw new Error();
      setPreparing(false);
      await playClips(body.clips, (ok) => {
        setSpeaking(false);
        if (!ok) toast("error", "La lecture s'est interrompue.");
      });
    } catch {
      setPreparing(false);
      toast("error", `La voix ${inLanguage(target.lang)} n'est pas disponible pour le moment : lecture en français.`);
      french(content);
    }
  }

  function start() {
    const target = targetId ? document.getElementById(targetId) : null;
    const content = text ?? (target ? readableText(target) : "");
    if (!content.trim()) return;
    const lang = speechLanguage();
    if (lang) void local(content, lang);
    else french(content);
  }

  function stop() {
    stopVoice();
    setPreparing(false);
    setSpeaking(false);
  }

  const button = (
    <button
      type="button"
      onClick={speaking ? stop : start}
      aria-pressed={speaking}
      aria-busy={preparing || undefined}
      title={preparing ? "Préparation de la voix" : speaking ? "Arrêter la lecture" : label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-control border border-border-strong bg-surface font-semibold text-text shadow-xs transition-colors hover:border-field-border hover:bg-surface-2",
        compact === true ? "size-9" : compact === "mobile" ? "size-11 sm:h-11 sm:w-auto sm:px-3.5 sm:text-sm" : "h-10 px-3 text-sm",
        speaking && "border-primary bg-primary-soft text-primary",
        className,
      )}
    >
      {speaking ? <Square className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
      <span className={compact === true ? "sr-only" : compact === "mobile" ? "max-sm:sr-only" : undefined}>{preparing ? "Préparation…" : speaking ? "Arrêter" : label}</span>
    </button>
  );
  if (!text || !translatable) return button;
  return (
    <>
      {button}
      <TranslateContent text={text} compact={compact} />
    </>
  );
}
