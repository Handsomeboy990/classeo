"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { clock, spokenDuration } from "@/lib/domain/messaging";
import { cn } from "@/lib/utils";

// Compact player of a voice note: play or pause, the position as a slider
// the keyboard can move, and the time. The length comes from the recorder
// (a WebM recording does not carry it, the browser would show infinity).
// The file is only fetched on the first play, which spares the data of a
// weak connection.
export function VoicePlayer({ src, durationMs, label = "message vocal", className }: { src: string; durationMs: number; label?: string; className?: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [failed, setFailed] = useState(false);
  const total = Math.max(durationMs / 1000, 0.1);

  useEffect(() => {
    const a = audio.current;
    return () => a?.pause();
  }, []);

  async function toggle() {
    const a = audio.current;
    if (!a) return;
    if (!a.paused) return a.pause();
    // One voice note at a time on the page.
    document.querySelectorAll("audio").forEach((other) => other !== a && other.pause());
    try {
      setFailed(false);
      await a.play();
    } catch (error) {
      // A pause while loading rejects play(): not a failure.
      if ((error as Error).name !== "AbortError") setFailed(true);
    }
  }

  function seek(seconds: number) {
    const a = audio.current;
    if (!a) return;
    a.currentTime = Math.min(seconds, total);
    setPosition(a.currentTime);
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <audio
        ref={audio}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setPosition(0);
        }}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
        onError={() => {
          setPlaying(false);
          setFailed(true);
        }}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? `Mettre en pause le ${label}` : `Écouter le ${label}, ${spokenDuration(durationMs)}`}
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary shadow-xs hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {playing ? <Pause className="size-5" aria-hidden /> : <Play className="size-5 translate-x-px" aria-hidden />}
      </button>
      <input
        type="range"
        min={0}
        max={total}
        step={0.1}
        value={Math.min(position, total)}
        onChange={(e) => seek(Number(e.target.value))}
        aria-label={`Position dans le ${label}`}
        aria-valuetext={`${clock(position * 1000)} sur ${clock(durationMs)}`}
        className="h-2 min-w-16 flex-1 cursor-pointer accent-primary"
      />
      <span className="shrink-0 text-xs text-muted tabular-nums" aria-hidden>
        {playing || position > 0 ? clock(position * 1000) : clock(durationMs)}
      </span>
      {failed && (
        <span role="alert" className="text-xs font-semibold text-danger">
          Lecture impossible. Vérifiez le réseau et réessayez.
        </span>
      )}
    </div>
  );
}
