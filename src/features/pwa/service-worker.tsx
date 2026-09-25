"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { sealOfflineQueue } from "@/features/offline/client";

// Starts listening for the browser's install offer as early as possible.
import "./install";

// Registers /sw.js in production (in development it would serve stale
// bundles to the hot reloader). On the sign in page the private offline
// copies are purged, so a shared phone never shows the previous user's data,
// and the entries still waiting to be sent are sealed: kept on the device,
// replayed only when the same account signs in again.
export function ServiceWorkerRegistration() {
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Offline reading is an enhancement: the platform works without it.
    });
  }, []);

  useEffect(() => {
    if (pathname !== "/connexion") return;
    void sealOfflineQueue();
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ type: "purge-private" })).catch(() => {});
  }, [pathname]);

  return null;
}
