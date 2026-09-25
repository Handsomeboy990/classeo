"use client";

import { useSyncExternalStore } from "react";

// The in-app notification sound: two soft bell tones a fifth apart
// (A5 then E6), 0.6 s in all, synthesised with the Web Audio API, so there
// is no file to download. Each tone is a sine with a quiet octave partial,
// a 10 ms attack and an exponential decay: round, never shrill, and quiet
// (peak gain 0.14). Browsers play sound only after the person has
// interacted with the page once; before that the chime is silently skipped.

const KEY = "classeo:sound";
const listeners = new Set<() => void>();

export function soundEnabled() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Private mode: the choice lasts for this visit only.
  }
  listeners.forEach((l) => l());
}

export function useSoundEnabled() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    soundEnabled,
    () => true,
  );
}

let ctx: AudioContext | null = null;

function tone(ac: AudioContext, frequency: number, start: number, length: number, peak: number) {
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  gain.connect(ac.destination);
  for (const [mult, level] of [
    [1, 1],
    [2, 0.18],
  ] as const) {
    const osc = ac.createOscillator();
    const partial = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency * mult;
    partial.gain.value = level;
    osc.connect(partial).connect(gain);
    osc.start(start);
    osc.stop(start + length + 0.02);
  }
}

export async function playChime(force = false) {
  if (!force && !soundEnabled()) return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === "suspended") await ctx.resume();
    if (ctx.state !== "running") return;
    const t = ctx.currentTime + 0.02;
    tone(ctx, 880, t, 0.42, 0.14);
    tone(ctx, 1318.5, t + 0.14, 0.5, 0.11);
  } catch {
    // No audio device or blocked by the browser: the visual signal remains.
  }
}
