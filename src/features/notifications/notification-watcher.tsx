"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { NEW_NOTIFICATION_EVENT } from "@/components/shell/bell-link";

import { unreadSnapshot } from "./actions";
import { playChime } from "./chime";

const POLL_MS = 45_000;

function signal() {
  void playChime();
  window.dispatchEvent(new Event(NEW_NOTIFICATION_EVENT));
}

// Notices new notifications while Classéo is open: every 45 seconds when
// the tab is visible, as soon as it becomes visible again, at once when the
// service worker receives a push, and when a page load brings a newer one.
// Something new plays the chime (unless turned off in Préférences), rings
// the bell, refreshes the counts and is announced to screen readers: the
// sound is never the only signal. "New" means created after the newest one
// already known, so reading a notification never sounds.
export function NotificationWatcher({ latestAt }: { latestAt: number | null }) {
  const router = useRouter();
  const newest = useRef(latestAt ?? 0);
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    if (latestAt && latestAt > newest.current) {
      newest.current = latestAt;
      signal();
    }
  }, [latestAt]);

  useEffect(() => {
    let busy = false;
    async function check() {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const snap = await unreadSnapshot();
        if (snap?.latestAt && snap.latestAt > newest.current) {
          newest.current = snap.latestAt;
          signal();
          setAnnounce(`Nouvelle notification : ${snap.latestTitle ?? ""}`);
          router.refresh();
        }
      } finally {
        busy = false;
      }
    }
    const timer = window.setInterval(check, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && check();
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "push-received") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [router]);

  return (
    <p className="sr-only" role="status" aria-live="polite">
      {announce}
    </p>
  );
}
