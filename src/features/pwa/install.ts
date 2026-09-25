"use client";

import { useSyncExternalStore } from "react";

// Installation of the web app. Chrome and Edge on Android and desktop fire
// beforeinstallprompt: it is kept here so our own button can open the
// browser's install dialog later. Safari on iPhone has no such event: the
// user adds the app from the Share menu, so we explain that instead.

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallMode = "standalone" | "prompt" | "ios" | "none";

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

// Listening starts as soon as this module loads (it is part of the root
// layout bundle), because the event may fire before any component mounts.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
}

export function isStandalone() {
  return matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIosSafari() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return ios && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

function mode(): InstallMode {
  if (installed || isStandalone()) return "standalone";
  if (deferred) return "prompt";
  if (isIosSafari()) return "ios";
  return "none";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const mq = matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    mq.removeEventListener("change", listener);
  };
}

export function useInstallMode(): InstallMode {
  return useSyncExternalStore(subscribe, mode, () => "none");
}

// Opens the browser's own install dialog. Resolves true when accepted.
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  deferred = null;
  emit();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome === "accepted";
}

// The invitation card is offered once: dismissing it hides it for good, and
// a card left open only survives until the end of the visit.
const DISMISSED = "classeo:install-card";
const VISIT = "classeo:install-card-visit";

function firstOffer() {
  try {
    if (localStorage.getItem(DISMISSED) === "dismissed") return false;
    if (localStorage.getItem(DISMISSED) === "shown") return sessionStorage.getItem(VISIT) === "1";
    localStorage.setItem(DISMISSED, "shown");
    sessionStorage.setItem(VISIT, "1");
    return true;
  } catch {
    return false;
  }
}

let offered: boolean | undefined;

function offerSnapshot() {
  const m = mode();
  if (m !== "prompt" && m !== "ios") return false;
  if (offered === undefined) offered = firstOffer();
  return offered;
}

// True while the invitation card should be on screen.
export function useInstallOffer(): boolean {
  return useSyncExternalStore(subscribe, offerSnapshot, () => false);
}

export function dismissInstallOffer() {
  offered = false;
  emit();
  try {
    localStorage.setItem(DISMISSED, "dismissed");
    sessionStorage.removeItem(VISIT);
  } catch {
    // Private mode: the card simply comes back on the next visit.
  }
}
