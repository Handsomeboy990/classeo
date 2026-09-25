"use client";

import { AlertTriangle, CloudUpload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import { counts } from "./queue";
import { onReplayApplied, requestOfflinePages, setOfflineUser, syncNow, useOfflineEntries } from "./client";

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

// Mounted once in the private space layout, for the signed in account:
// - marks the page with the account id, so the service worker only keeps a
//   copy of a page for the account it was rendered for;
// - asks for the key pages of the role to be downloaded in the background;
// - replays the offline queue when the network returns, when the app comes
//   back to the front, and at start;
// - shows in the top area how many entries wait and how many were refused.
export function OfflineSession({ userId, pages }: { userId: string; pages: string[] }) {
  const router = useRouter();
  const entries = useOfflineEntries();
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const { pending, rejected } = counts(entries);

  useEffect(() => {
    void setOfflineUser(userId).then(() => syncNow());
  }, [userId]);

  const pagesKey = pages.join("\n");
  useEffect(() => {
    // After the first paint and when the browser is idle: never competes
    // with the page the user is reading.
    const run = () => void requestOfflinePages({ userId, urls: pagesKey.split("\n") }).catch(() => undefined);
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) idle(run, { timeout: 5000 });
    else setTimeout(run, 2000);
  }, [userId, pagesKey]);

  useEffect(() => {
    const trigger = () => void syncNow();
    const visible = () => document.visibilityState === "visible" && trigger();
    window.addEventListener("online", trigger);
    window.addEventListener("focus", trigger);
    document.addEventListener("visibilitychange", visible);
    const timer = window.setInterval(trigger, 60_000);
    const off = onReplayApplied(() => router.refresh());
    return () => {
      window.removeEventListener("online", trigger);
      window.removeEventListener("focus", trigger);
      document.removeEventListener("visibilitychange", visible);
      window.clearInterval(timer);
      off();
    };
  }, [router]);

  return (
    <div data-offline-user={userId} role="status" aria-live="polite">
      {(pending > 0 || rejected > 0) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-warning-soft px-4 py-2 text-sm sm:px-6" data-offline-status>
          {pending > 0 && (
            <p className="flex items-center gap-2 font-semibold">
              <CloudUpload className="size-4 shrink-0 text-warning" aria-hidden />
              <span>
                {pending > 1 ? `${pending} saisies en attente d'envoi` : "1 saisie en attente d'envoi"}
                <span className="font-normal text-muted">{online ? ", envoi en cours" : ", envoi au retour du réseau"}</span>
              </span>
            </p>
          )}
          {rejected > 0 && (
            <Link href="/espace/preferences#hors-ligne" className="flex items-center gap-2 font-semibold text-danger underline underline-offset-2">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              {rejected > 1 ? `${rejected} saisies à revoir` : "1 saisie à revoir"}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
