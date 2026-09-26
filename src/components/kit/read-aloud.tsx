"use client";

import { Loader2, Square, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";

import { frenchTextOf, speechLanguage } from "@/features/languages/client";
import { inLanguage, type TargetLanguage } from "@/features/languages/languages";
import { TranslateContent } from "@/features/languages/translate-content";
import { cn } from "@/lib/utils";
import { playClips, primeAudio, speak, stop as stopVoice } from "@/lib/voice/kora";

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
// readable text of an element: in French with the voice of the server
// (Siwis, the same on every device), or with the device's own French
// female voice when the server cannot (outage, offline). In Fon,
// Yoruba or Hausa with the voice of the translation service, for a user who
// chose that language (translation:view), or for any visitor when `lang` is
// given, as on the public pages; `text` is then the French source, the
// server translates it. A local voice that fails falls back to French. With
// a text of its own, it also offers "Traduire en ..." to the users holding
// translation:view.
export function ReadAloud({
  text,
  targetId,
  lang,
  label = "Écouter",
  className,
  compact = false,
  translatable = true,
}: {
  text?: string;
  targetId?: string;
  // Language to read in. Absent: the language chosen by the user, French
  // for everyone else.
  lang?: "fr" | "fon" | "yo" | "ha";
  // Accessible name of the button, also its tooltip.
  label?: string;
  className?: string;
  // true: the smaller round button, for lists and cards. The translate
  // button beside it follows the same setting.
  compact?: boolean | "mobile";
  // false: no "Traduire" button next to this one.
  translatable?: boolean;
}) {
  const [speaking, setSpeaking] = useState(false);
  const [preparing, setPreparing] = useState(false);

  useEffect(() => () => stopVoice(), []);

  function french(content: string) {
    primeAudio();
    setSpeaking(true);
    setPreparing(true);
    void speak(
      content,
      (outcome) => {
        setPreparing(false);
        setSpeaking(false);
        if (outcome === "unavailable") toast("error", "La lecture vocale n'est pas disponible sur ce navigateur.");
        else if (outcome === "failed") toast("error", "La lecture s'est interrompue.");
      },
      () => setPreparing(false),
    );
  }

  async function local(content: string, target: TargetLanguage) {
    primeAudio();
    setSpeaking(true);
    setPreparing(true);
    try {
      const res = await fetch("/api/langues/voix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang: target, text: content.slice(0, 6000) }),
      });
      const body = (await res.json().catch(() => ({}))) as { clips?: string[] };
      if (!res.ok || !body.clips?.length) throw new Error();
      setPreparing(false);
      await playClips(body.clips, (outcome) => {
        setSpeaking(false);
        if (outcome === "failed") toast("error", "La lecture s'est interrompue.");
      });
    } catch {
      setPreparing(false);
      toast("error", `La voix ${inLanguage(target)} n'est pas disponible pour le moment : lecture en français.`);
      french(content);
    }
  }

  function start() {
    const target = targetId ? document.getElementById(targetId) : null;
    const content = text ?? (target ? readableText(target) : "");
    if (!content.trim()) return;
    const language = lang ? (lang === "fr" ? null : lang) : (speechLanguage()?.lang ?? null);
    if (language) void local(content, language);
    else french(content);
  }

  function stop() {
    stopVoice();
    setPreparing(false);
    setSpeaking(false);
  }

  // A speaker button only: the text it reads is never shown next to it.
  // The name stays the same ("Écouter le bulletin"), pressed while it
  // speaks; a polite status tells screen reader users what happens.
  const status = preparing ? "Préparation de la voix" : speaking ? "Lecture en cours" : "";
  const button = (
    <>
      <button
        type="button"
        onClick={speaking ? stop : start}
        aria-label={label}
        aria-pressed={speaking}
        aria-busy={preparing || undefined}
        title={preparing ? "Préparation de la voix" : speaking ? "Arrêter la lecture" : label}
        data-speaking={speaking || undefined}
        data-size={compact === true ? "sm" : undefined}
        className={cn("ds-speak", className)}
      >
        {preparing ? <Loader2 className="animate-spin" aria-hidden /> : speaking ? <Square aria-hidden /> : <Volume2 aria-hidden />}
      </button>
      <span role="status" className="sr-only">
        {status}
      </span>
    </>
  );
  if (!text || !translatable) return button;
  return (
    <>
      {button}
      <TranslateContent text={text} compact />
    </>
  );
}
