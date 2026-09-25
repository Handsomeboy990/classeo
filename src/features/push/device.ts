"use client";

import { useEffect, useSyncExternalStore } from "react";

import { checkPushDevice, subscribePush, unsubscribePush } from "./actions";

// State of web push on this device, shared by every toggle on screen.
//
// unknown       not checked yet
// unsupported   no service worker or no Push API (development build, old browser)
// ios-install   Safari on iPhone: push needs the app on the home screen first
// denied        the user blocked notifications for the site
// off, on       the switch position; busy while a change is in progress
export type PushStatus = "unknown" | "unsupported" | "ios-install" | "denied" | "off" | "on" | "busy";

let status: PushStatus = "unknown";
let checking: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: PushStatus) {
  status = next;
  listeners.forEach((l) => l());
}

function supported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function iosBrowser() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

async function registration() {
  // getRegistration never waits: in development no worker is registered.
  return (await navigator.serviceWorker.getRegistration("/")) ?? null;
}

function base64UrlToBytes(value: string) {
  const padded = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

// First look at this device. A subscription left by someone else who used
// this browser is removed: their notifications must not reach the person
// now signed in.
async function check() {
  if (!supported()) return set(iosBrowser() ? "ios-install" : "unsupported");
  const reg = await registration();
  if (!reg) return set("unsupported");
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    const result = await checkPushDevice(null, { endpoint: sub.endpoint });
    const mine = result?.ok && (result.data as { mine?: boolean } | undefined)?.mine;
    if (mine) return set("on");
    await sub.unsubscribe().catch(() => undefined);
  }
  set(Notification.permission === "denied" ? "denied" : "off");
}

export function usePushStatus(enabled: boolean): PushStatus {
  const value = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => status,
    () => "unknown" as PushStatus,
  );
  useEffect(() => {
    if (!enabled || status !== "unknown" || checking) return;
    checking = check()
      .catch(() => set("unsupported"))
      .finally(() => {
        checking = null;
      });
  }, [enabled]);
  return value;
}

export async function enablePush(publicKey: string): Promise<{ ok: boolean; message?: string }> {
  const reg = await registration();
  if (!reg) return { ok: false, message: "Les notifications ne sont pas disponibles dans ce navigateur." };
  set("busy");
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      set(permission === "denied" ? "denied" : "off");
      return { ok: false };
    }
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) });
    const json = sub.toJSON() as { endpoint: string; keys?: { p256dh?: string; auth?: string } };
    const result = await subscribePush(null, { endpoint: json.endpoint, keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" } });
    if (!result?.ok) {
      await sub.unsubscribe().catch(() => undefined);
      set("off");
      return { ok: false, message: result?.message };
    }
    set("on");
    return { ok: true, message: result.message };
  } catch {
    set("off");
    return { ok: false, message: "L'abonnement aux notifications a échoué. Réessayez dans un instant." };
  }
}

export async function disablePush(): Promise<{ ok: boolean; message?: string }> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) {
    set("off");
    return { ok: true };
  }
  set("busy");
  try {
    const result = await unsubscribePush(null, { endpoint: sub.endpoint });
    await sub.unsubscribe();
    set("off");
    return { ok: true, message: result?.message };
  } catch {
    set("on");
    return { ok: false, message: "Les notifications n'ont pas pu être désactivées. Réessayez dans un instant." };
  }
}

// Before signing out: this device stops receiving the user's notifications.
// Never holds the sign out for more than a second and a half.
export async function releaseDevice() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  await Promise.race([disablePush().catch(() => undefined), new Promise((r) => setTimeout(r, 1500))]);
}
