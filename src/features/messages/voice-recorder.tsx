"use client";

import { Mic, SendHorizonal, Square, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { toast } from "@/components/kit/toaster";
import { Button } from "@/components/ui/button";
import { newClientId } from "@/features/offline/client";
import { clock, VOICE_NOTE_MAX_MS, VOICE_NOTE_MIN_MS } from "@/lib/domain/messaging";
import { cn } from "@/lib/utils";

import { sendVoiceNote } from "./actions";
import { VoicePlayer } from "./voice-player";

type Phase = { name: "idle" } | { name: "asking" } | { name: "recording"; startedAt: number } | { name: "preview"; blob: Blob; url: string; durationMs: number } | { name: "sending"; blob: Blob; url: string; durationMs: number };

// Formats the browser can record, best first: Opus in WebM (Chrome,
// Android, Edge), Opus in Ogg (Firefox), AAC in MP4 (Safari, iPhone).
const TYPES = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4", "audio/webm"];

const OFFLINE = "Les messages vocaux ont besoin du réseau. Écrivez votre message : il partira tout seul au retour du réseau.";
const DENIED = "Le micro est bloqué pour Classéo. Autorisez-le dans les réglages du navigateur (l'icône à gauche de l'adresse, ou Réglages puis Safari sur iPhone), puis réessayez.";

function recordingType() {
  if (typeof MediaRecorder === "undefined") return null;
  return TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

function extension(type: string) {
  return type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm";
}

// A voice note, as in WhatsApp: a tap on the microphone starts, the timer
// runs up to two minutes (the recording stops on its own there), then the
// person listens to it and sends it or throws it away. Cancel is always one
// tap away. The microphone is released as soon as the recording stops.
export function VoiceRecorder({ conversationId, onActiveChange, onError }: { conversationId: string; onActiveChange?: (active: boolean) => void; onError: (message: string | null) => void }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const setError = onError;
  const [elapsed, setElapsed] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const discard = useRef(false);
  const startedAt = useRef(0);
  const stopButton = useRef<HTMLButtonElement>(null);
  const micButton = useRef<HTMLButtonElement>(null);
  const active = phase.name !== "idle";

  useEffect(() => onActiveChange?.(active), [active, onActiveChange]);

  // The timer, and the automatic stop at two minutes.
  useEffect(() => {
    if (phase.name !== "recording") return;
    const id = window.setInterval(() => {
      const ms = performance.now() - phase.startedAt;
      setElapsed(ms);
      if (ms >= VOICE_NOTE_MAX_MS) recorder.current?.stop();
    }, 200);
    return () => window.clearInterval(id);
  }, [phase]);

  // Leaving the page releases the microphone and the preview.
  useEffect(
    () => () => {
      discard.current = true;
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  function release() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }

  async function start() {
    setError(null);
    if (navigator.onLine === false) return setError(OFFLINE);
    const type = recordingType();
    if (type === null || !navigator.mediaDevices?.getUserMedia) return setError("Ce navigateur ne sait pas enregistrer la voix. Essayez avec Chrome, ou Safari à jour sur iPhone.");
    setPhase({ name: "asking" });
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      setPhase({ name: "idle" });
      const name = (e as Error).name;
      setError(name === "NotAllowedError" || name === "SecurityError" ? DENIED : name === "NotFoundError" ? "Aucun micro trouvé sur cet appareil." : "Le micro n'a pas pu démarrer. Fermez les autres applications qui l'utilisent, puis réessayez.");
      return;
    }
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream.current, type ? { mimeType: type, audioBitsPerSecond: 32_000 } : undefined);
    recorder.current = rec;
    discard.current = false;
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstop = () => {
      release();
      const durationMs = Math.min(performance.now() - startedAt.current, VOICE_NOTE_MAX_MS);
      if (discard.current) return setPhase({ name: "idle" });
      if (durationMs < VOICE_NOTE_MIN_MS || !chunks.length) {
        setPhase({ name: "idle" });
        setError("Message trop court. Appuyez sur le micro, parlez, puis appuyez sur Arrêter.");
        return;
      }
      const blob = new Blob(chunks, { type: rec.mimeType || type || "audio/webm" });
      setPhase({ name: "preview", blob, url: URL.createObjectURL(blob), durationMs });
    };
    startedAt.current = performance.now();
    rec.start();
    setElapsed(0);
    setPhase({ name: "recording", startedAt: startedAt.current });
    requestAnimationFrame(() => stopButton.current?.focus());
  }

  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  function cancel() {
    discard.current = true;
    if (recorder.current?.state === "recording") recorder.current.stop();
    else {
      if (phase.name === "preview") URL.revokeObjectURL(phase.url);
      setPhase({ name: "idle" });
    }
    release();
    requestAnimationFrame(() => micButton.current?.focus());
  }

  async function send() {
    if (phase.name !== "preview") return;
    if (navigator.onLine === false) return setError(OFFLINE);
    setError(null);
    setPhase({ ...phase, name: "sending" });
    const form = new FormData();
    form.set("conversationId", conversationId);
    form.set("audio", new File([phase.blob], `message-vocal.${extension(phase.blob.type)}`, { type: phase.blob.type }));
    form.set("durationMs", String(Math.round(phase.durationMs)));
    form.set("clientId", newClientId());
    try {
      const result = await sendVoiceNote(null, form);
      if (!result?.ok) {
        setPhase({ ...phase, name: "preview" });
        setError(result?.message ?? "Le message vocal n'est pas parti. Réessayez.");
        return;
      }
      URL.revokeObjectURL(phase.url);
      setPhase({ name: "idle" });
      toast("success", "Message vocal envoyé.");
      router.refresh();
      requestAnimationFrame(() => micButton.current?.focus());
    } catch {
      setPhase({ ...phase, name: "preview" });
      setError("Le serveur n'a pas pu être joint. Votre enregistrement est gardé : réessayez quand le réseau revient.");
    }
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", active && "flex-1")}>
      {phase.name === "idle" || phase.name === "asking" ? (
        <Button
          ref={micButton}
          type="button"
          variant="secondary"
          size="icon"
          onClick={start}
          loading={phase.name === "asking"}
          aria-label="Enregistrer un message vocal"
          title="Enregistrer un message vocal"
          className="size-12 shrink-0 self-end [&_svg]:size-5"
        >
          <Mic aria-hidden />
        </Button>
      ) : phase.name === "recording" ? (
        <div className="flex min-h-12 items-center gap-2 rounded-control border border-danger/40 bg-danger-soft py-1 pr-1 pl-4" role="group" aria-label="Enregistrement du message vocal">
          <span className="size-3 shrink-0 rounded-full bg-danger motion-safe:animate-pulse" aria-hidden />
          <p className="min-w-0 flex-1 text-sm font-semibold">
            <span className="sr-only" role="status">
              Enregistrement en cours.
            </span>
            <span className="tabular-nums" aria-hidden>
              {clock(elapsed)}
            </span>
            <span className="text-muted" aria-hidden>
              {" "}
              / {clock(VOICE_NOTE_MAX_MS)}
            </span>
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={cancel}>
            <Trash2 aria-hidden /> Annuler
          </Button>
          <Button ref={stopButton} type="button" variant="danger" size="sm" onClick={stop}>
            <Square aria-hidden /> Arrêter
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface-2 p-2" role="group" aria-label="Message vocal prêt à partir">
          <VoicePlayer src={phase.url} durationMs={phase.durationMs} label="message vocal enregistré" className="min-w-48 flex-1" />
          <div className="flex gap-2">
            <Button type="button" variant="danger-ghost" size="sm" onClick={cancel} disabled={phase.name === "sending"}>
              <Trash2 aria-hidden /> Supprimer
            </Button>
            <Button type="button" size="sm" onClick={send} loading={phase.name === "sending"}>
              <SendHorizonal aria-hidden /> {phase.name === "sending" ? "Envoi…" : "Envoyer"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
