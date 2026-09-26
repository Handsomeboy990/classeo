"use client";

import { Languages, Square, Volume2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { playClips, primeAudio, stop as stopVoice } from "@/lib/voice/kora";

import { useLanguageState } from "./client";
import { bcp47, inLanguage, voiceOf, type TargetLanguage } from "./languages";

type Result = { paragraphs: { source: string; text: string; translated: boolean }[]; complete: boolean };
type Phase = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "done"; result: Result };

// "Traduire en fongbe" on an announcement or a message, for the users
// holding translation:view: the text translated on request (cache first),
// shown in a dialog next to the French original, and read aloud in the
// language when the service has a voice for it.
export function TranslateContent({ text, compact = false, className }: { text: string; compact?: boolean | "mobile"; className?: string }) {
  const s = useLanguageState();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [speaking, setSpeaking] = useState<"idle" | "preparing" | "playing">("idle");
  const [asked, setAsked] = useState<TargetLanguage | null>(null);

  if (!s.allowed || !text.trim()) return null;
  const lang: TargetLanguage = s.lang !== "fr" ? s.lang : s.lastLocal;
  const label = `Traduire ${inLanguage(lang)}`;
  const voice = voiceOf(lang, s.voices);

  async function load() {
    setPhase({ kind: "loading" });
    setAsked(lang);
    try {
      const res = await fetch("/api/langues/contenu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, text: text.slice(0, 8000) }),
      });
      const body = (await res.json().catch(() => ({}))) as Partial<Result> & { error?: string };
      if (!res.ok || !body.paragraphs) throw new Error(body.error ?? "La traduction n'est pas disponible pour le moment. Le texte reste en français.");
      setPhase({ kind: "done", result: { paragraphs: body.paragraphs, complete: !!body.complete } });
    } catch (e) {
      setPhase({ kind: "error", message: e instanceof Error && e.message ? e.message : "La traduction n'est pas disponible pour le moment." });
    }
  }

  function openDialog() {
    setOpen(true);
    if (phase.kind !== "done" || asked !== lang) void load();
  }

  function close() {
    stopVoice();
    setSpeaking("idle");
    setOpen(false);
  }

  async function listen() {
    if (speaking !== "idle") {
      stopVoice();
      setSpeaking("idle");
      return;
    }
    primeAudio();
    setSpeaking("preparing");
    try {
      const res = await fetch("/api/langues/voix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, text: text.slice(0, 6000) }),
      });
      const body = (await res.json().catch(() => ({}))) as { clips?: string[]; error?: string };
      if (!res.ok || !body.clips?.length) throw new Error(body.error);
      setSpeaking("playing");
      await playClips(body.clips, () => setSpeaking("idle"));
    } catch {
      setSpeaking("idle");
      setPhase((p) => (p.kind === "done" ? p : { kind: "error", message: "La voix n'est pas disponible pour le moment." }));
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        aria-haspopup="dialog"
        title={label}
        className={cn(
          "inline-flex shrink-0 items-center justify-center gap-2 rounded-control border border-border-strong bg-surface font-semibold text-text shadow-xs transition-colors hover:border-field-border hover:bg-surface-2",
          compact === true ? "size-10" : compact === "mobile" ? "size-11 sm:h-11 sm:w-auto sm:px-3.5 sm:text-sm" : "h-10 px-3 text-sm",
          className,
        )}
      >
        <Languages className="size-4" aria-hidden />
        <span className={compact === true ? "sr-only" : compact === "mobile" ? "max-sm:sr-only" : undefined}>{label}</span>
      </button>
      <Dialog
        open={open}
        onClose={close}
        title={`Traduction ${inLanguage(lang)}`}
        description="Traduction automatique : en cas de doute, le texte français fait foi."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            {voice && phase.kind === "done" && (
              <Button variant="secondary" onClick={listen} aria-pressed={speaking !== "idle"} loading={speaking === "preparing"}>
                {speaking === "playing" ? <Square aria-hidden /> : <Volume2 aria-hidden />}
                {speaking === "preparing" ? "Préparation de la voix…" : speaking === "playing" ? "Arrêter" : `Écouter ${inLanguage(lang)}`}
              </Button>
            )}
            <Button onClick={close}>Fermer</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {phase.kind === "loading" && (
            <p role="status" className="text-muted">
              Traduction en cours…
            </p>
          )}
          {phase.kind === "error" && (
            <div role="alert" className="flex flex-col items-start gap-3">
              <p>{phase.message}</p>
              <Button variant="secondary" size="sm" onClick={() => void load()}>
                Réessayer
              </Button>
            </div>
          )}
          {phase.kind === "done" && (
            <>
              <div lang={bcp47(lang)} data-no-translate className="flex flex-col gap-2 text-lg leading-relaxed">
                {phase.result.paragraphs.map((p, i) => (
                  <p key={i}>{p.text}</p>
                ))}
              </div>
              {!phase.result.complete && <p className="text-sm text-muted">Une partie du texte n&apos;a pas pu être traduite : elle reste en français.</p>}
            </>
          )}
          <details className="rounded-card border border-border px-4 py-3">
            <summary className="cursor-pointer font-semibold">Texte original en français</summary>
            <p lang="fr" data-no-translate className="mt-2 whitespace-pre-line text-muted">
              {text}
            </p>
          </details>
        </div>
      </Dialog>
    </>
  );
}
