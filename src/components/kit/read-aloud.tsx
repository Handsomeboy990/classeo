"use client";

import { Square, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import { toast } from "./toaster";

function frenchVoice() {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === "fr-FR") ?? voices.find((v) => v.lang.startsWith("fr")) ?? null;
}

function readRate() {
  try {
    return Number(localStorage.getItem("classeo:voice-rate")) || 0.95;
  } catch {
    return 0.95;
  }
}

// "Kora", the voice of Classeo. Reads a text, or the visible text of an
// element, aloud in French with the browser's speech engine: no download, no
// server, works offline once the page is loaded.
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

  useEffect(
    () => () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    [],
  );

  function start() {
    if (!("speechSynthesis" in window)) {
      toast("error", "La lecture vocale n'est pas disponible sur ce navigateur.");
      return;
    }
    const content = text ?? (targetId ? document.getElementById(targetId)?.innerText : "") ?? "";
    if (!content.trim()) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = "fr-FR";
    const voice = frenchVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = readRate();
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(utterance);
  }

  function stop() {
    window.speechSynthesis.cancel();
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
